import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import mysql from 'mysql2/promise';
import cookieParser from 'cookie-parser';

dotenv.config();

// Firebase Admin Initialization
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_SERVICE_ACCOUNT_PATH not set in environment');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

// Use cookie-parser and JSON middleware (for /sessionLogin)
const app = express();
app.use(cookieParser());
app.use(express.json());

// checkAuth middleware (uses the session cookie)
async function checkAuth(req, res, next) {
  try {
    const sessionCookie = req.cookies.session || '';
    if (!sessionCookie) {
      console.error('No session cookie provided.');
      return res.redirect('/');
    }
    const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error("Authentication error:", err);
    return res.redirect('/');
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const port = process.env.PORT || 3000;

// Define protected route for /home.html BEFORE static middleware
app.get('/home.html', checkAuth, (req, res) => {
  const homePath = join(__dirname, 'home.html');
  if (fs.existsSync(homePath)) {
    res.sendFile(homePath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title>Default Dashboard</title>
      </head>
      <body>
         <h1>Default Dashboard</h1>
         <p>home.html not found</p>
      </body>
      </html>
    `);
  }
});

// Now serve static files for other assets
app.use(express.static(__dirname, { index: false }));

// Root => index.html (login page)
app.get('/', (req, res) => {
  const loginPath = join(__dirname, 'index.html');
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title>Default Login Page</title>
      </head>
      <body>
         <h1>Default Login Page</h1>
         <p>index.html not found</p>
      </body>
      </html>
    `);
  }
});

// Cloud SQL + GCS configuration
const dbConfig = {
  host: process.env.DB_HOST, // For App Engine, e.g. "/cloudsql/instance-connection-name"
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};
const upload = multer({ storage: multer.memoryStorage() });
const storageClient = new Storage();
const bucketName = process.env.GCS_BUCKET || 'return-request';

/*
  NEW ENDPOINT:
  GET /api/signedUrl?file=your_file_name
  This generates a fresh signed URL valid for 7 days for the provided file name.
*/
app.get('/api/signedUrl', async (req, res) => {
  try {
    const fileName = req.query.file;
    if (!fileName) {
      return res.status(400).json({ error: 'File parameter is required.' });
    }
    const bucketFile = storageClient.bucket(bucketName).file(fileName);
    const [signedUrl] = await bucketFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.json({ signedUrl });
  } catch (err) {
    console.error('Error generating signed URL:', err);
    res.status(500).json({ error: 'Failed to generate signed URL.' });
  }
});

// POST /returns (protected route)
// Modified: instead of storing signed URLs, we store the file names.
app.post('/returns', checkAuth, upload.array('media'), async (req, res) => {
  try {
    const { trackingNumber, reason, applicant } = req.body;
    const fileNames = [];

    // Upload each file to GCS and store its file name
    for (const file of req.files) {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.originalname}`;
      const bucketFile = storageClient.bucket(bucketName).file(fileName);
      await bucketFile.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        resumable: false,
      });
      fileNames.push(fileName);
    }

    // Insert record into Cloud SQL for Return_Request
    const connection = await mysql.createConnection(dbConfig);
    const insertQuery = `
      INSERT INTO Return_Request (applicant, trackingNumber, reason, mediaUrls, submittedAt)
      VALUES (?, ?, ?, ?, ?)
    `;
    const submittedAt = new Date();
    // Save the file names as JSON
    const fileNamesJSON = JSON.stringify(fileNames);
    await connection.execute(insertQuery, [
      applicant || (req.user ? req.user.email : 'anonymous'),
      trackingNumber,
      reason,
      fileNamesJSON,
      submittedAt,
    ]);
    await connection.end();

    console.log('Return Request Submission:', {
      applicant: applicant || (req.user ? req.user.email : 'anonymous'),
      trackingNumber,
      reason,
      fileNames,
      submittedAt: submittedAt.toISOString(),
    });

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Submission Successful</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body {
            background-color: #f8f9fa;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .card {
            width: 100%;
            max-width: 400px;
            box-shadow: 0 0 15px rgba(0,0,0,0.1);
          }
          .card-header {
            background-color: #0d6efd;
            color: #fff;
            text-align: center;
          }
          .card-body {
            text-align: center;
          }
          .btn-custom {
            background-color: #0d6efd;
            color: #fff;
            border: none;
            padding: 10px 20px;
            font-size: 16px;
            margin-top: 20px;
            transition: background-color 0.3s ease;
          }
          .btn-custom:hover {
            background-color: #0b5ed7;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-header">
            <h4>Submission Successful</h4>
          </div>
          <div class="card-body">
            <p>Your return request has been submitted successfully!</p>
            <button class="btn btn-custom" onclick="window.location.href='/home.html'">Go Back</button>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error processing return request:', err);
    res.status(500).send('An error occurred while submitting your request.');
  }
});

// GET /api/returns endpoint - MODIFIED to include id field
app.get('/api/returns', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT id, applicant, trackingNumber, reason, mediaUrls, submittedAt
      FROM Return_Request
      ORDER BY submittedAt DESC
    `);
    await connection.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching return requests:', err);
    res.status(500).json({ error: 'An error occurred while fetching return requests.' });
  }
});

// NEW ENDPOINT: API endpoint to update a return item
app.post('/api/updateReturn', async (req, res) => {
  try {
    const { id, trackingNumber, reason, applicant } = req.body;
    
    // Validate required fields
    if (!id || !trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID and tracking number are required' 
      });
    }
    
    // Create a connection to the database
    const connection = await mysql.createConnection(dbConfig);
    
    // Update the return item in the database
    const updateQuery = `
      UPDATE Return_Request 
      SET trackingNumber = ?, reason = ?, applicant = ? 
      WHERE id = ?
    `;
    
    const [result] = await connection.execute(updateQuery, [
      trackingNumber,
      reason,
      applicant || 'anonymous',
      id
    ]);
    
    await connection.end();
    
    // Check if the update was successful
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Return item not found' 
      });
    }
    
    // Return the updated item data
    res.json({
      success: true,
      id,
      trackingNumber,
      reason,
      applicant: applicant || 'anonymous'
    });
    
  } catch (error) {
    console.error('Error updating return item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating return item' 
    });
  }
});

// NEW ENDPOINT: API endpoint to delete a return item
app.post('/api/deleteReturn', async (req, res) => {
  try {
    const { id } = req.body;
    
    // Validate required fields
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID is required' 
      });
    }
    
    // First, get the mediaUrls to delete from Cloud Storage
    const connection = await mysql.createConnection(dbConfig);
    
    // Optional: Get the media files to delete them from storage
    const [rows] = await connection.execute(
      'SELECT mediaUrls FROM Return_Request WHERE id = ?',
      [id]
    );
    
    // Delete the return item from the database
    const [result] = await connection.execute(
      'DELETE FROM Return_Request WHERE id = ?',
      [id]
    );
    
    await connection.end();
    
    // Check if the delete was successful
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Return item not found' 
      });
    }
    
    // Optional: Delete media files from Cloud Storage
    if (rows.length > 0 && rows[0].mediaUrls) {
      try {
        let mediaFiles = [];
        try {
          mediaFiles = JSON.parse(rows[0].mediaUrls);
        } catch (e) {
          console.warn('Could not parse mediaUrls as JSON:', e);
          if (typeof rows[0].mediaUrls === 'string') {
            mediaFiles = [rows[0].mediaUrls];
          }
        }
        
        // Delete each file from storage
        for (const fileName of mediaFiles) {
          try {
            await storageClient.bucket(bucketName).file(fileName).delete();
            console.log(`Deleted file: ${fileName}`);
          } catch (fileErr) {
            console.warn(`Could not delete file ${fileName}:`, fileErr);
          }
        }
      } catch (mediaErr) {
        console.warn('Error deleting media files:', mediaErr);
      }
    }
    
    // Return success response
    res.json({
      success: true,
      message: 'Return item deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting return item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting return item' 
    });
  }
});

// -------------------------
// Repair Request Endpoints
// -------------------------

// -------------------------
// POST /repairs (protected route)
// -------------------------
app.post('/repairs', checkAuth, upload.array('media'), async (req, res) => {
  try {
    // Destructure fields from the request body
    const { receive_date, repair_date, purpose, order_id, variation, issue, actions, applicant } = req.body;
    
    // Validate and format date fields (assuming YYYY-MM-DD input)
    const validReceiveDate = receive_date && /^\d{4}-\d{2}-\d{2}$/.test(receive_date) ? receive_date : null;
    const validRepairDate = repair_date && /^\d{4}-\d{2}-\d{2}$/.test(repair_date) ? repair_date : null;

    // Array to store file names (not signed URLs)
    const fileNames = [];
    
    // Upload each file to GCS and store its file name
    for (const file of req.files) {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.originalname}`;
      const bucketFile = storageClient.bucket(bucketName).file(fileName);
      await bucketFile.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        resumable: false,
      });
      fileNames.push(fileName);
    }
    
    // Generate a repair_id in the format REP-YYMMDD-XXX
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
    const repairId = `REP-${year}${month}${day}-${randomStr}`;
    
    // Create a connection to Cloud SQL
    const connection = await mysql.createConnection(dbConfig);
    const insertQuery = `
      INSERT INTO Repair_Request 
      (repair_id, receive_date, repair_date, purpose, order_id, variation, issue, actions, applicant, media, submittedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const submittedAt = new Date();
    const fileNamesJSON = JSON.stringify(fileNames);
    
    // Insert the repair request record; if applicant isn't provided in the form,
    // fall back to the authenticated user's email
    await connection.execute(insertQuery, [
      repairId,
      validReceiveDate,
      validRepairDate,
      purpose || null,
      order_id || null,
      variation || null,
      issue || null,
      actions || null,
      applicant || (req.user ? req.user.email : 'anonymous'),
      fileNamesJSON,
      submittedAt,
    ]);
    await connection.end();
    
    console.log('Repair Request Submission:', {
      repair_id: repairId,
      receive_date: validReceiveDate,
      repair_date: validRepairDate,
      purpose,
      order_id: order_id || null,
      variation,
      issue,
      actions,
      applicant: applicant || (req.user ? req.user.email : 'anonymous'),
      fileNames,
      submittedAt: submittedAt.toISOString(),
    });
    
    // Create a standalone HTML page for the successful submission
    const successHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repair Request Submitted</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      background-color: #f8f9fa;
      font-family: Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      width: 100%;
      max-width: 400px;
      box-shadow: 0 0 15px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .card-header {
      background-color: #0d6efd;
      color: #fff;
      text-align: center;
      padding: 15px;
      font-size: 1.5rem;
    }
    .card-body {
      text-align: center;
      padding: 30px 20px;
    }
    .btn-custom {
      background-color: #0d6efd;
      color: #fff;
      border: none;
      padding: 10px 30px;
      font-size: 16px;
      margin-top: 20px;
      border-radius: 5px;
      transition: background-color 0.3s ease;
    }
    .btn-custom:hover {
      background-color: #0b5ed7;
    }
    .repair-id {
      font-family: monospace;
      letter-spacing: 1px;
      font-size: 1.4rem;
      color: #0d6efd;
      font-weight: bold;
      margin: 15px 0;
      background: #f0f8ff;
      padding: 10px;
      border-radius: 5px;
      border: 1px solid #d1e6ff;
      display: inline-block;
    }
    .copy-btn {
      background: none;
      border: none;
      color: #6c757d;
      cursor: pointer;
      padding: 5px;
      margin-left: 5px;
      vertical-align: middle;
    }
    .copy-btn:hover {
      color: #0d6efd;
    }
    .copy-icon {
      width: 18px;
      height: 18px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      Repair Request Submitted
    </div>
    <div class="card-body">
      <p>Your repair request has been submitted successfully!</p>
      <div>
        <p>Your Repair ID:</p>
        <div class="repair-id">
          ${repairId}
          <button class="copy-btn" onclick="copyRepairId()" title="Copy to clipboard">
            <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </button>
        </div>
      </div>
      <p class="text-muted">Please save this ID for your records</p>
      <button class="btn btn-custom" onclick="goBack()">Go Back</button>
    </div>
  </div>

  <script>
    function copyRepairId() {
      const repairId = "${repairId}";
      navigator.clipboard.writeText(repairId).then(() => {
        alert("Repair ID copied to clipboard!");
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    }
    
    function goBack() {
      window.location.href = '/home.html';
    }
  </script>
</body>
</html>
    `;
    
    // Send the complete HTML page
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(successHTML);
    
  } catch (err) {
    console.error('Error processing repair request:', err);
    res.status(500).send('An error occurred while submitting your repair request.');
  }
});

// -------------------------
// GET /api/repairs endpoint
// -------------------------
app.get('/api/repairs', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(`
      SELECT repair_id, receive_date, repair_date, purpose, order_id, variation, issue, actions, applicant, media, submittedAt
      FROM Repair_Request
      ORDER BY submittedAt DESC
    `);
    await connection.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching repair requests:', err);
    res.status(500).json({ error: 'An error occurred while fetching repair requests.' });
  }
});

// -------------------------
// NEW ENDPOINT: API endpoint to update a repair item
// -------------------------
app.post('/api/updateRepair', async (req, res) => {
  try {
    const { repair_id, receive_date, repair_date, purpose, order_id, variation, issue, actions, applicant } = req.body;
    
    // Validate required fields
    if (!repair_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Repair ID is required' 
      });
    }
    
    // Create a connection to the database
    const connection = await mysql.createConnection(dbConfig);
    
    // Update the repair item in the database
    const updateQuery = `
      UPDATE Repair_Request 
      SET receive_date = ?, repair_date = ?, purpose = ?, order_id = ?, 
          variation = ?, issue = ?, actions = ?, applicant = ?
      WHERE repair_id = ?
    `;
    
    const [result] = await connection.execute(updateQuery, [
      receive_date || null,
      repair_date || null,
      purpose || null,
      order_id || null,
      variation || null,
      issue || null,
      actions || null,
      applicant || 'anonymous',
      repair_id
    ]);
    
    await connection.end();
    
    // Check if the update was successful
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Repair item not found' 
      });
    }
    
    // Return the updated item data
    res.json({
      success: true,
      repair_id,
      receive_date,
      repair_date,
      purpose,
      order_id,
      variation,
      issue,
      actions,
      applicant: applicant || 'anonymous'
    });
    
  } catch (error) {
    console.error('Error updating repair item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating repair item' 
    });
  }
});

// -------------------------
// NEW ENDPOINT: API endpoint to delete a repair item
// -------------------------
app.post('/api/deleteRepair', async (req, res) => {
  try {
    const { repair_id } = req.body;
    
    // Validate required fields
    if (!repair_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Repair ID is required' 
      });
    }
    
    // First, get the media to delete from Cloud Storage
    const connection = await mysql.createConnection(dbConfig);
    
    // Get the media files to delete them from storage
    const [rows] = await connection.execute(
      'SELECT media FROM Repair_Request WHERE repair_id = ?',
      [repair_id]
    );
    
    // Delete the repair item from the database
    const [result] = await connection.execute(
      'DELETE FROM Repair_Request WHERE repair_id = ?',
      [repair_id]
    );
    
    await connection.end();
    
    // Check if the delete was successful
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Repair item not found' 
      });
    }
    
    // Delete media files from Cloud Storage
    if (rows.length > 0 && rows[0].media) {
      try {
        let mediaFiles = [];
        try {
          mediaFiles = JSON.parse(rows[0].media);
        } catch (e) {
          console.warn('Could not parse media as JSON:', e);
          if (typeof rows[0].media === 'string') {
            mediaFiles = [rows[0].media];
          }
        }
        
        // Delete each file from storage
        for (const fileName of mediaFiles) {
          try {
            await storageClient.bucket(bucketName).file(fileName).delete();
            console.log(`Deleted file: ${fileName}`);
          } catch (fileErr) {
            console.warn(`Could not delete file ${fileName}:`, fileErr);
          }
        }
      } catch (mediaErr) {
        console.warn('Error deleting media files:', mediaErr);
      }
    }
    
    // Return success response
    res.json({
      success: true,
      message: 'Repair item deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting repair item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting repair item' 
    });
  }
});

// Endpoint to exchange ID token for a session cookie
app.post('/sessionLogin', express.json(), async (req, res) => {
  const idToken = req.body.idToken;
  const expiresIn = 24 * 60 * 60 * 1000; // 1 day
  try {
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
    const options = { maxAge: expiresIn, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.cookie('session', sessionCookie, options);
    res.status(200).send('Session cookie set.');
  } catch (error) {
    console.error("Error creating session cookie:", error);
    res.status(401).send('Unauthorized request');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
// server.js
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// --- 1. Session Configuration ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mySuperSecretKey123!@#',
    resave: false,
    saveUninitialized: false
  })
);

// --- 2. Passport Configuration ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
      callbackURL: '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      // In production, you'd look up or create a user record here.
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user); // You might only serialize user.id in a real app.
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

// --- 3. Serve Static Files (like index.html) ---
app.use(express.static(__dirname));

// --- 4. A Simple Login Page Route ---
app.get('/login', (req, res) => {
  // If already logged in, go straight to '/'
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  // Otherwise, show a basic login page with a link to Google OAuth
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login</title>
    </head>
    <body>
      <h1>Please Log In</h1>
      <p><a href="/auth/google">Sign in with Google</a></p>
    </body>
    </html>
  `);
});

// --- 5. Start Google OAuth Flow ---
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// --- 6. Google OAuth Callback ---
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // On success, go to the protected home page
    res.redirect('/');
  }
);

// --- 7. Middleware to Protect Routes ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  // If not logged in, show the login page
  res.redirect('/login');
}

// --- 8. Protected Home Route ---
app.get('/', ensureAuthenticated, (req, res) => {
  // If you're authenticated, we serve index.html from the current directory
  res.sendFile(join(__dirname, 'index.html'));
});

// --- 9. Logout Route ---
app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// --- 10. Start the Server ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

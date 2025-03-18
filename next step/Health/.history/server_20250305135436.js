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

// --- Session Configuration ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mySuperSecretKey123!@#',
    resave: false,
    saveUninitialized: false
  })
);

// --- Passport Configuration ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
      callbackURL: '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      // In production, look up or create the user record here.
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  // In production, you might serialize only user.id.
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

// --- Serve Static Files Without Automatically Serving index.html ---
app.use(express.static(__dirname, { index: false }));

// --- Login Page Route ---
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    // If already logged in, redirect to the home page.
    return res.redirect('/');
  }
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

// --- Start Google OAuth Flow ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// --- Google OAuth Callback ---
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to the protected home page.
    res.redirect('/');
  }
);

// --- Middleware to Protect Routes ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// --- Protected Home Route ---
app.get('/', ensureAuthenticated, (req, res) => {
  // Serve index.html if the user is authenticated.
  res.sendFile(join(__dirname, 'index.html'));
});

// --- Logout Route ---
app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// --- Start the Server ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
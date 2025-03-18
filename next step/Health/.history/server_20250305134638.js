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

// Serve static files (including index.html) from current directory
app.use(express.static(__dirname));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mySuperSecretKey123!@#',
    resave: false,
    saveUninitialized: false
  })
);

// Passport Google OAuth configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
      callbackURL: '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      // In production, you'd lookup or create a user in your DB here
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  // Typically you'd serialize only the user ID here
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

// Simple endpoint to return the logged-in user's email
app.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  // Passport's Google profile typically has emails[0].value
  const email = req.user?.emails?.[0]?.value || 'No email found';
  res.json({ email });
});

// Login page
app.get('/login', (req, res) => {
  res.send(`
    <h1>Login</h1>
    <p><a href="/auth/google">Sign in with Google</a></p>
  `);
});

// Start Google OAuth flow
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // On success, redirect to protected home page
    res.redirect('/');
  }
);

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Protected root route, serves index.html
app.get('/', ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Logout route
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
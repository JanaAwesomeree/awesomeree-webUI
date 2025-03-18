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
const port = 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// -- Session Configuration --
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mySuperSecretKey123!@#',
    resave: false,
    saveUninitialized: false
  })
);

// -- Passport Configuration --
// Configure Google OAuth strategy.
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '494910305254-5os9mkmil0t6ajnglbkjerrgknffj5k6.apps.googleusercontent.com',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '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',
      callbackURL: '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      // In production, you might look up or create a user record here.
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  // Here, you might serialize just the user ID
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

// -- Routes --

// Public Login Page
app.get('/login', (req, res) => {
  res.send(`
    <h1>Login</h1>
    <p><a href="/auth/google">Sign in with Google</a></p>
  `);
});

// Start Google OAuth flow
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to the protected home page.
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

// Protected Home Route: Serve index.html after login.
app.get('/', ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Logout Route
app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

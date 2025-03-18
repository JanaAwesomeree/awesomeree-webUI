// server.js
import express from 'express';
import helmet from 'helmet';
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

// -- Security Middleware --
app.use(helmet());

// -- Session Configuration --
const sessionSecret = process.env.SESSION_SECRET || 'mySuperSecretKey123!@#';
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  })
);

// -- Passport Configuration --
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '494910305254-5os9mkmil0t6ajnglbkjerrgknffj5k6.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback' // Must match the redirect URI in Google Cloud Console
    },
    (accessToken, refreshToken, profile, done) => {
      // In production, lookup or create the user in your database here.
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  // In production, you might only serialize the user ID.
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

// -- Serve Static Files --
// Disable automatic index serving so that our custom route for '/' takes precedence.
app.use(express.static(__dirname, { index: false }));

// -- Middleware to Protect Routes --
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// -- Routes --

// Public Login Page
app.get('/login', (req, res) => {
  res.send(`
    <h1>Please Log In</h1>
    <p><a href="/auth/google">Sign in with Google</a></p>
  `);
});

// Protected Home Route: Serve index.html only after login.
app.get('/', ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Start Google OAuth Flow.
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth Callback Route.
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // On successful authentication, redirect to the protected home page.
    res.redirect('/');
  }
);

// Logout Route.
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// -- Error Handling Middleware --
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

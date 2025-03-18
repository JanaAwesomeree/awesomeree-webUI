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
// Configure Helmet with custom CSP directives.
// We include 'script-src-elem' and 'script-src-attr' to allow inline event handlers.
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

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
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
      callbackURL: '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  )
);
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});
app.use(passport.initialize());
app.use(passport.session());

// -- Serve Static Files --
app.use(express.static(__dirname, { index: false }));

// -- Middleware to Protect Routes --
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// -- Routes --
app.get('/login', (req, res) => {
  res.send(`
    <h1>Please Log In</h1>
    <p><a href="/auth/google">Sign in with Google</a></p>
  `);
});
app.get('/', ensureAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
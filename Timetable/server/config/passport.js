const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Only configure Google Strategy if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'],
    passReqToCallback: true
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value.toLowerCase();

      // Check if email domain is allowed
      if (!User.isAllowedDomain(email)) {
        return done(null, false, {
          message: `Only college email addresses are allowed. Your email domain is not authorized.`
        });
      }

      // Check if user already exists with this Google ID
      let user = await User.findOne({ googleId: profile.id });

      if (user) {
        // Existing Google user — mark as verified, update login
        user.googleVerified = true;
        user.lastLogin = new Date();
        user.profilePicture = profile.photos?.[0]?.value || user.profilePicture;
        await user.save();
        return done(null, user);
      }

      // Check if user exists with same email (registered via local auth or pre-existing)
      user = await User.findOne({ email });

      if (user) {
        // Link Google account to existing user and mark as verified
        user.googleId = profile.id;
        user.googleVerified = true;
        user.profilePicture = profile.photos?.[0]?.value;
        user.lastLogin = new Date();
        // Keep existing authProvider if they already have a password, otherwise set to google
        if (!user.password) {
          user.authProvider = 'google';
        }
        await user.save();
        console.log(`✅ Google verified existing account: ${email} (role: ${user.role})`);
        return done(null, user);
      }

      // No existing account — auto-create with role from session or default to student
      const role = req.session?.pendingRole || 'student';
      const newUser = new User({
        name: profile.displayName || email.split('@')[0],
        email: email,
        googleId: profile.id,
        profilePicture: profile.photos?.[0]?.value,
        authProvider: 'google',
        googleVerified: true,
        role: role,
        lastLogin: new Date(),
        isActive: true
      });
      await newUser.save();
      console.log(`✅ Auto-created Google-verified account: ${email} (role: ${role})`);

      // Clear the pending role from session
      if (req.session) {
        delete req.session.pendingRole;
      }

      return done(null, newUser);

    } catch (err) {
      return done(err, null);
    }
  }));

  console.log('✅ Google OAuth configured');
} else {
  console.log('⚠️  Google OAuth not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env)');
}

module.exports = passport;

const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Principal = require('../models/Principal');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Helper: Get role-specific model
const getRoleModel = (role) => {
  switch (role) {
    case 'student': return Student;
    case 'faculty': return Faculty;
    case 'principal': return Principal;
    default: return null; // dean, hod, coordinator, admin use main User model
  }
};

// Helper: Generate JWT token
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Helper: Sync user to role-specific collection
const syncToRoleCollection = async (userData) => {
  const Model = getRoleModel(userData.role);
  if (!Model) return; // roles without separate collections skip

  try {
    const existing = await Model.findOne({ email: userData.email });
    if (!existing) {
      const roleData = {
        name: userData.name,
        email: userData.email,
        googleId: userData.googleId,
        profilePicture: userData.profilePicture,
        authProvider: userData.authProvider,
        googleVerified: userData.googleVerified,
        department: userData.department,
        phone: userData.phone,
        isActive: userData.isActive,
        lastLogin: userData.lastLogin,
      };

      // Add role-specific fields
      if (userData.role === 'student') {
        roleData.division = userData.division;
        roleData.semester = userData.semester;
        roleData.enrollmentId = userData.enrollmentId;
      } else if (userData.role === 'faculty') {
        roleData.employeeId = userData.employeeId;
        roleData.specializations = userData.specializations;
        roleData.maxWeeklyHours = userData.maxWeeklyHours;
      } else if (userData.role === 'principal') {
        roleData.employeeId = userData.employeeId;
      }

      // Copy hashed password if exists
      if (userData.password) {
        // Directly set the already-hashed password
        const doc = new Model(roleData);
        doc.password = userData.password;
        await doc.save({ validateModifiedOnly: true });
      } else {
        await Model.create(roleData);
      }
    } else {
      // Update existing role-specific record
      existing.googleId = userData.googleId || existing.googleId;
      existing.googleVerified = userData.googleVerified || existing.googleVerified;
      existing.profilePicture = userData.profilePicture || existing.profilePicture;
      existing.lastLogin = userData.lastLogin;
      await existing.save();
    }
  } catch (err) {
    console.error(`Error syncing to ${userData.role} collection:`, err.message);
  }
};

// POST /api/auth/register — Register with role selection + Google verification required
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }

    const validRoles = ['principal', 'dean', 'hod', 'coordinator', 'faculty', 'student', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role selected.' });
    }

    // Validate email domain
    const isAllowed = await User.isAllowedDomain(email);
    if (!isAllowed) {
      const CC = require('mongoose').model('CollegeConfig');
      const config = await CC.getConfig();
      return res.status(403).json({
        message: `Only college email addresses are allowed (${config.allowedDomains.join(', ')}). Please use your institutional email.`
      });
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists. Please login instead.' });
    }

    // Create user — googleVerified = false (needs Google sign-in to verify)
    const user = new User({
      name,
      email,
      password,
      role,
      authProvider: 'local',
      googleVerified: false,
      isActive: true
    });
    await user.save();

    res.status(201).json({
      message: 'Account created successfully! Please sign in with Google to verify your college email.',
      requiresGoogleVerification: true,
      email: user.email
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/auth/login (Email + Password — for Google-verified OR admin-approved users)
router.post('/login', async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;

    // Domain check removed for login — if user exists in DB, allow login attempt
    // Domain validation is enforced at registration only

    const user = await User.findOne({ email }).populate('department');
    if (!user) {
      return res.status(401).json({ message: 'No account found with this email. Please register first.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact your administrator.' });
    }

    // ─── ROLE ENFORCEMENT ───
    // If the frontend sends the role selected on the login page, enforce it
    if (expectedRole && user.role !== expectedRole) {
      // Friendly role labels for the error message
      const roleLabels = {
        student: 'Student', faculty: 'Faculty', coordinator: 'Coordinator',
        hod: 'HOD', principal: 'Principal', admin: 'Admin', dean: 'Dean'
      };
      return res.status(403).json({
        message: `This account is registered as "${roleLabels[user.role] || user.role}". Please select the correct role on the login page and try again.`,
        actualRole: user.role
      });
    }

    // Allow login if: (1) Google-verified, OR (2) admin-approved account
    const canLogin = user.googleVerified || user.isApproved || user.authProvider === 'local';
    if (!canLogin) {
      return res.status(403).json({
        message: 'Your account needs to be verified. Please sign in with Google once to verify your college email, or contact the admin for approval.',
        requiresGoogleVerification: true
      });
    }

    // For Google-only accounts without password
    if (!user.password) {
      return res.status(400).json({
        message: 'No password set for this account. Please sign in with Google or contact admin to set a password.',
        needsPassword: true,
        email: user.email
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    res.json({ token, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});


// GET /api/auth/google — Initiate Google OAuth (with role in query param for new registrations)
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    return res.status(503).json({ message: 'Google Sign-In is not configured yet. Contact your administrator.' });
  }

  // Store role in session for new user creation during callback
  const role = req.query.role || 'student';
  req.session.pendingRole = role;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
});

// GET /api/auth/google/callback — Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_auth_failed`
  }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.redirect(`${process.env.CLIENT_URL}/login?error=no_account`);
      }

      const populatedUser = await User.findById(user._id).populate('department');
      const token = generateToken(populatedUser);

      // Sync to role-specific collection
      await syncToRoleCollection(populatedUser);

      // Redirect to frontend with token
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?token=${token}&user=${encodeURIComponent(JSON.stringify(populatedUser.toJSON()))}`);
    } catch (error) {
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=server_error`);
    }
  }
);

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('department');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/auth/password — Set/change password (for any logged-in user)
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // If user has no password yet (first time setting after Google login)
    if (!user.password) {
      user.password = newPassword;
      await user.save();
      return res.json({ message: 'Password set successfully! You can now login with email and password.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/auth/set-password — Set password after Google verification
router.post('/set-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    if (!user.googleVerified) {
      return res.status(403).json({ message: 'Google verification is required first.' });
    }

    user.password = password;
    await user.save();

    // Also sync password to role-specific collection
    const Model = getRoleModel(user.role);
    if (Model) {
      const roleUser = await Model.findOne({ email });
      if (roleUser) {
        roleUser.password = password;
        await roleUser.save();
      }
    }

    const populatedUser = await User.findById(user._id).populate('department');
    const token = generateToken(populatedUser);

    res.json({
      message: 'Password set successfully! You can now login with email and password.',
      token,
      user: populatedUser.toJSON()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/auth/allowed-domains — Public route to get allowed domains
router.get('/allowed-domains', async (req, res) => {
  try {
    const CC = require('mongoose').model('CollegeConfig');
    const config = await CC.getConfig();
    res.json({ domains: config.allowedDomains });
  } catch (err) {
    res.status(500).json({ domains: [] });
  }
});

// GET /api/auth/google-enabled — Check if Google OAuth is configured
router.get('/google-enabled', (req, res) => {
  const enabled = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';
  res.json({ enabled });
});

// GET /api/auth/check-email — Check if email exists and its verification status
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      googleVerified: user.googleVerified,
      role: user.role,
      hasPassword: !!user.password,
      authProvider: user.authProvider
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

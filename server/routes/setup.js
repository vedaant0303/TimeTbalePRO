const express = require('express');
const CollegeConfig = require('../models/CollegeConfig');
const Department = require('../models/Department');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Room = require('../models/Room');
const TimeSlot = require('../models/TimeSlot');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/setup/status — Check if setup is complete (public)
router.get('/status', async (req, res) => {
  try {
    const config = await CollegeConfig.getConfig();
    res.json({
      isSetupComplete: config.isSetupComplete,
      collegeName: config.collegeName,
      collegeCode: config.collegeCode,
      logo: config.logo
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/setup/config — Get full college config (authenticated)
router.get('/config', auth, async (req, res) => {
  try {
    const config = await CollegeConfig.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/setup/initialize — First-time college setup (creates admin + departments)
router.post('/initialize', async (req, res) => {
  try {
    const config = await CollegeConfig.getConfig();
    
    // Allow re-setup if not complete
    if (config.isSetupComplete) {
      return res.status(400).json({ message: 'Setup already complete. Use admin panel to modify.' });
    }

    const {
      collegeName, collegeCode, address, website, email, phone,
      allowedDomains, departments: deptList,
      adminName, adminEmail, adminPassword,
      settings
    } = req.body;

    // Validate required
    if (!collegeName) return res.status(400).json({ message: 'College name is required.' });
    if (!adminEmail || !adminPassword) return res.status(400).json({ message: 'Admin email and password are required.' });

    // Update college config
    config.collegeName = collegeName;
    config.collegeCode = collegeCode || '';
    config.address = address || '';
    config.website = website || '';
    config.email = email || '';
    config.phone = phone || '';
    config.allowedDomains = allowedDomains || ['college.edu.in'];
    if (settings) config.settings = { ...config.settings, ...settings };
    config.isSetupComplete = true;
    config.setupCompletedAt = new Date();
    await config.save();

    // Create admin user if not exists
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = new User({
        name: adminName || 'Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        authProvider: 'local',
        googleVerified: true,
        isActive: true,
        isApproved: true
      });
      await adminUser.save();
    }

    config.setupBy = adminUser._id;
    await config.save();

    // Create departments
    const createdDepts = [];
    if (deptList && deptList.length > 0) {
      for (const dept of deptList) {
        const existing = await Department.findOne({ code: dept.code });
        if (!existing) {
          const newDept = await Department.create({
            name: dept.name,
            code: dept.code,
            hod: dept.hod || null,
            divisions: dept.divisions || ['1', '2', '3']
          });
          createdDepts.push(newDept);
        } else {
          createdDepts.push(existing);
        }
      }
    }

    res.json({
      message: 'College setup complete!',
      config,
      departments: createdDepts,
      admin: { name: adminUser.name, email: adminUser.email }
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ message: 'Setup failed.', error: error.message });
  }
});

// PUT /api/setup/config — Update college config (admin only)
router.put('/config', auth, authorize('admin'), async (req, res) => {
  try {
    const config = await CollegeConfig.getConfig();
    const updates = req.body;
    
    if (updates.collegeName) config.collegeName = updates.collegeName;
    if (updates.collegeCode) config.collegeCode = updates.collegeCode;
    if (updates.address !== undefined) config.address = updates.address;
    if (updates.website !== undefined) config.website = updates.website;
    if (updates.email !== undefined) config.email = updates.email;
    if (updates.phone !== undefined) config.phone = updates.phone;
    if (updates.logo !== undefined) config.logo = updates.logo;
    if (updates.allowedDomains) config.allowedDomains = updates.allowedDomains;
    if (updates.settings) config.settings = { ...config.settings, ...updates.settings };
    
    await config.save();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/setup/reset — Full reset for new college deployment (admin only)
router.post('/reset', auth, authorize('admin'), async (req, res) => {
  try {
    const { confirmReset } = req.body;
    if (confirmReset !== 'RESET_ALL_DATA') {
      return res.status(400).json({ message: 'Send confirmReset: "RESET_ALL_DATA" to confirm.' });
    }

    // Clear all collections except the admin user
    const adminId = req.user._id;
    
    await Promise.all([
      Student.deleteMany({}),
      Faculty.deleteMany({}),
      Room.deleteMany({}),
      TimeSlot.deleteMany({}),
      Department.deleteMany({}),
      User.deleteMany({ _id: { $ne: adminId } }),
      CollegeConfig.deleteMany({})
    ]);

    // Create fresh config
    const config = await CollegeConfig.create({
      collegeName: 'My College',
      isSetupComplete: false
    });

    res.json({ message: 'All data reset. Setup wizard will appear on next visit.', config });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ message: 'Reset failed.', error: error.message });
  }
});

module.exports = router;

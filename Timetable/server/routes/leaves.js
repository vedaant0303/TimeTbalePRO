const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/leaves/pending — All pending leave requests (for HOD/Principal)
router.get('/pending', auth, authorize('hod', 'principal', 'admin'), async (req, res) => {
  try {
    const filter = {
      role: 'faculty',
      'unavailability.status': 'pending',
      isActive: true
    };

    // HOD sees only their department
    if (req.user.role === 'hod' && req.user.department) {
      const deptId = req.user.department._id || req.user.department;
      filter.department = deptId;
    }

    const users = await User.find(filter)
      .populate('department')
      .select('name email department unavailability')
      .sort({ name: 1 });

    // Flatten: each user's pending unavailability entries as separate items
    const leaves = [];
    for (const u of users) {
      for (const ua of u.unavailability) {
        if (ua.status === 'pending') {
          leaves.push({
            _id: ua._id,
            userId: u._id,
            facultyName: u.name,
            facultyEmail: u.email,
            department: u.department,
            date: ua.date,
            reason: ua.reason,
            status: ua.status
          });
        }
      }
    }

    res.json(leaves);
  } catch (error) {
    console.error('Leave fetch error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/leaves/all — All leave requests with optional status filter
router.get('/all', auth, authorize('hod', 'principal', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { role: 'faculty', isActive: true };

    if (req.user.role === 'hod' && req.user.department) {
      const deptId = req.user.department._id || req.user.department;
      filter.department = deptId;
    }

    const users = await User.find(filter)
      .populate('department')
      .select('name email department unavailability')
      .sort({ name: 1 });

    const leaves = [];
    for (const u of users) {
      for (const ua of u.unavailability) {
        if (!status || ua.status === status) {
          leaves.push({
            _id: ua._id,
            userId: u._id,
            facultyName: u.name,
            facultyEmail: u.email,
            department: u.department,
            date: ua.date,
            reason: ua.reason,
            status: ua.status
          });
        }
      }
    }

    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/leaves/:userId/:leaveId — Approve or reject a leave
router.put('/:userId/:leaveId', auth, authorize('hod', 'principal', 'admin'), async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const leave = user.unavailability.id(req.params.leaveId);
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    leave.status = status;
    await user.save();

    // Notify via socket
    const io = req.app.get('io');
    io.emit('leave-updated', {
      userId: user._id,
      leaveId: leave._id,
      status,
      approvedBy: req.user.name
    });

    res.json({ message: `Leave ${status}.`, leave });
  } catch (error) {
    console.error('Leave update error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

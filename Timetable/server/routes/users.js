const express = require('express');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Principal = require('../models/Principal');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Helper: Get role-specific model
const getRoleModel = (role) => {
  switch (role) {
    case 'student': return Student;
    case 'faculty': return Faculty;
    case 'principal': return Principal;
    default: return null;
  }
};

// GET /api/users
router.get('/', auth, authorize('admin', 'principal', 'dean', 'hod', 'coordinator', 'faculty'), async (req, res) => {
  try {
    const { role, department, isActive } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    // Coordinator can only see students of their department by default
    if (req.user.role === 'coordinator' && !department && role !== 'faculty') {
      filter.department = req.user.department;
    }
    const users = await User.find(filter).populate('department').sort({ name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/users/students — Get all students from separate collection
router.get('/students', auth, authorize('admin', 'principal', 'dean', 'hod', 'coordinator'), async (req, res) => {
  try {
    const { department, division, semester, classId, batch } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (division) filter.division = division;
    if (semester) filter.semester = Number(semester);
    if (classId) filter.classId = classId;
    if (batch) filter.batch = batch;
    // Coordinator auto-filter to their department
    if (req.user.role === 'coordinator' && !department && req.user.department) {
      filter.department = req.user.department;
    }
    const students = await Student.find(filter).populate('department classId').sort({ rollNumber: 1, name: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/users/students/:id — Update student batch/division/semester
router.put('/students/:id', auth, authorize('admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const { batch, division, semester, classId } = req.body;
    const update = {};
    if (batch !== undefined) update.batch = batch;
    if (division !== undefined) update.division = division;
    if (semester !== undefined) update.semester = semester;
    if (classId !== undefined) update.classId = classId;
    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('department classId');
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/users/students/batch/bulk — Bulk update batches
router.put('/students/batch/bulk', auth, authorize('admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const { updates } = req.body; // [{id, batch}]
    if (!updates || !updates.length) return res.status(400).json({ message: 'No updates provided.' });
    let count = 0;
    for (const u of updates) {
      await Student.findByIdAndUpdate(u.id, { batch: u.batch });
      count++;
    }
    res.json({ message: `Updated ${count} students.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/users/students — Add a new student
router.post('/students', auth, authorize('admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const { name, email, password, department, semester, division, batch, rollNumber, enrollmentId, phone } = req.body;

    // 1. Create the Student record in the Student collection
    const student = new Student({
      name, email, password, department, semester, division, batch,
      rollNumber, enrollmentId, phone,
      authProvider: 'local',
      isActive: true
    });
    await student.save();

    // 2. Also create a User record so the student can LOGIN
    //    Login uses the User model, so the student MUST exist there too.
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      const user = new User({
        name, email, password,
        role: 'student',
        department, division, semester,
        enrollmentId: rollNumber || enrollmentId,
        phone,
        authProvider: 'local',
        isApproved: true,      // Can login immediately
        googleVerified: true,  // Skip Google check
        isActive: true
      });
      await user.save();
    }

    const populated = await Student.findById(student._id).populate('department classId');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Student email already exists.' });
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/users/faculty — Get all faculty from separate collection
router.get('/faculty', auth, authorize('admin', 'principal', 'dean', 'hod', 'coordinator', 'faculty'), async (req, res) => {
  try {
    const { department } = req.query;
    const filter = {};
    if (department) {
      // Faculty model uses 'departments' (array) and/or 'department' (single)
      filter.$or = [
        { department: department },
        { departments: department }
      ];
    }
    const faculty = await Faculty.find(filter).populate('department departments').sort({ name: 1 });
    res.json(faculty);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/users/principals — Get all principals from separate collection
router.get('/principals', auth, authorize('admin'), async (req, res) => {
  try {
    const principals = await Principal.find({}).sort({ name: 1 });
    res.json(principals);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/users
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    // Admin-created users are auto-approved and can login immediately
    const userData = {
      ...req.body,
      isApproved: true,
      googleVerified: true,  // Skip Google verification for admin-created users
      isActive: true,
      authProvider: 'local'
    };
    const user = new User(userData);
    await user.save();

    // Also sync to role-specific collection if applicable
    const roleModel = getRoleModel(user.role);
    if (roleModel) {
      const existing = await roleModel.findOne({ email: user.email });
      if (!existing) {
        const roleData = {
          name: user.name,
          email: user.email,
          department: user.department,
          phone: user.phone,
          isActive: true,
          employeeId: user.employeeId,
        };
        if (user.role === 'student') {
          roleData.division = user.division;
          roleData.semester = user.semester;
          roleData.enrollmentId = user.enrollmentId;
        }
        await roleModel.create(roleData);
      }
    }

    const populated = await User.findById(user._id).populate('department');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { password, resetPassword, ...updateData } = req.body;
    // Admin can update anything; coordinator/hod can only update batch field on students
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user._id.toString() === req.params.id;
    const isCoordOrHod = ['coordinator', 'hod'].includes(req.user.role);
    if (!isAdmin && !isSelf && isCoordOrHod) {
      // Restrict to batch and division updates only
      const allowedKeys = ['batch', 'division'];
      const restricted = Object.keys(updateData).filter(k => !allowedKeys.includes(k));
      if (restricted.length > 0) {
        return res.status(403).json({ message: `Coordinators can only update batch/division fields.` });
      }
    } else if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Unauthorized to update this user.' });
    }

    // Handle password reset (admin only)
    if (resetPassword && isAdmin) {
      const userToReset = await User.findById(req.params.id);
      if (userToReset) {
        userToReset.password = resetPassword;
        await userToReset.save(); // triggers pre-save hash
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('department');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE /api/users/:id (soft delete)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User deactivated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/users/:id/unavailability
router.post('/:id/unavailability', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.unavailability.push(req.body);
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/users/pending — Users awaiting admin approval
router.get('/pending', auth, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({ isApproved: false, isActive: true })
      .populate('department').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/users/:id/approve — Admin approves a user
router.put('/:id/approve', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isApproved: true, approvedBy: req.user._id, approvedAt: new Date()
    }, { new: true }).populate('department');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/users/:id/reject — Admin rejects/denies access
router.put('/:id/reject', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isApproved: false, isActive: false
    }, { new: true }).populate('department');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User access denied.', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT /api/users/:id/reactivate — Admin re-enables a deactivated user
router.put('/:id/reactivate', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isActive: true,
      isApproved: true  // Ensure they can login immediately
    }, { new: true }).populate('department');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

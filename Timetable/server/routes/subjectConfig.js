const express = require('express');
const SubjectAllocation = require('../models/SubjectAllocation');
const Class = require('../models/Class');
const { auth } = require('../middleware/auth');
const { requirePermission, requireAnyPermission, validateCoordinatorScope } = require('../middleware/permissions');
const router = express.Router();

// GET subject configs for a class + semester
router.get('/:classId/:semId', auth, async (req, res) => {
  try {
    const configs = await SubjectAllocation.find({
      classId: req.params.classId,
      semesterId: req.params.semId
    }).populate('classId theoryFacultyId batches.facultyId batches.labId combinedGroups.facultyId combinedGroups.labId fixedSlots.roomId')
      .sort({ 'subject.code': 1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET all subject configs for a department + semester
router.get('/dept/:deptId/:semId', auth, async (req, res) => {
  try {
    const configs = await SubjectAllocation.find({
      departmentId: req.params.deptId,
      semesterId: req.params.semId
    }).populate('classId theoryFacultyId')
      .sort({ 'subject.code': 1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST create subject config
router.post('/', auth, requireAnyPermission(['subjectConfig:create', 'subjectConfig:edit']), async (req, res) => {
  try {
    let { departmentId, classId, ...rest } = req.body;
    
    // Auto-resolve departmentId from class if missing
    if (!departmentId && classId) {
      const cls = await Class.findById(classId);
      if (cls) departmentId = cls.department;
    }

    const config = new SubjectAllocation({
      ...rest,
      classId,
      departmentId,
      submittedBy: req.user._id
    });
    await config.save();

    const populated = await SubjectAllocation.findById(config._id)
      .populate('classId theoryFacultyId batches.facultyId batches.labId');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject already configured for this class.' });
    }
    console.error('SubjectConfig create error:', error);
    res.status(500).json({ message: 'Failed to save subject config.', error: error.message });
  }
});

// PUT update subject config
router.put('/:id', auth, requireAnyPermission(['subjectConfig:create', 'subjectConfig:edit']), async (req, res) => {
  try {
    const config = await SubjectAllocation.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('classId theoryFacultyId batches.facultyId batches.labId');
    if (!config) return res.status(404).json({ message: 'Subject config not found.' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE subject config
router.delete('/:id', auth, requireAnyPermission(['subjectConfig:create', 'subjectConfig:edit']), async (req, res) => {
  try {
    await SubjectAllocation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Subject config deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT submit to HOD
router.put('/:id/submit', auth, requirePermission('subjectConfig:create'), async (req, res) => {
  try {
    const config = await SubjectAllocation.findByIdAndUpdate(req.params.id, {
      status: 'submitted',
      submittedBy: req.user._id,
      submittedAt: new Date()
    }, { new: true });
    if (!config) return res.status(404).json({ message: 'Subject config not found.' });

    const io = req.app.get('io');
    io.to('role-hod').emit('subject-config-submitted', { classId: config.classId });

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT submit all for a class
router.put('/submit-all/:classId/:semId', auth, requirePermission('subjectConfig:create'), async (req, res) => {
  try {
    await SubjectAllocation.updateMany(
      { classId: req.params.classId, semesterId: req.params.semId, status: 'draft' },
      { status: 'submitted', submittedBy: req.user._id, submittedAt: new Date() }
    );
    res.json({ message: 'All subject configs submitted for approval.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT HOD approve
router.put('/:id/approve', auth, requirePermission('subjectConfig:approve'), async (req, res) => {
  try {
    const config = await SubjectAllocation.findByIdAndUpdate(req.params.id, {
      status: 'approved',
      approvedBy: req.user._id,
      approvedAt: new Date()
    }, { new: true });
    if (!config) return res.status(404).json({ message: 'Subject config not found.' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT approve all for a class
router.put('/approve-all/:classId/:semId', auth, requirePermission('subjectConfig:approve'), async (req, res) => {
  try {
    await SubjectAllocation.updateMany(
      { classId: req.params.classId, semesterId: req.params.semId, status: 'submitted' },
      { status: 'approved', approvedBy: req.user._id, approvedAt: new Date() }
    );
    res.json({ message: 'All subject configs approved.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET classes for coordinator/HOD (their department's classes)
router.get('/my-classes/:semId', auth, async (req, res) => {
  try {
    let filter = {};
    // Both coordinator and HOD should see classes for their department
    if (req.user.department) {
      const deptId = req.user.department._id || req.user.department;
      filter.department = deptId;
    }
    // If admin/principal, show all classes
    if (['admin', 'principal', 'dean'].includes(req.user.role)) {
      filter = {};
    }
    const classes = await Class.find(filter).populate('department coordinator').sort({ name: 1 });
    res.json(classes);
  } catch (error) {
    console.error('my-classes error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

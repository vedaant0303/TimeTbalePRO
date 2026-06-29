const express = require('express');
const Class = require('../models/Class');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// GET all classes (filtered by department for coordinator/hod)
router.get('/', auth, async (req, res) => {
  try {
    const { department } = req.query;
    const filter = { isActive: true };
    if (department) filter.department = department;
    // If coordinator/hod, limit to their department
    if (['coordinator', 'hod'].includes(req.user.role) && req.user.department && !department) {
      filter.department = req.user.department._id || req.user.department;
    }
    const classes = await Class.find(filter).populate('department coordinator').sort({ year: 1, divisionNumber: 1 });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST create class
router.post('/', auth, authorize('admin', 'hod', 'coordinator'), async (req, res) => {
  try {
    const cls = new Class(req.body);
    await cls.save();
    const populated = await Class.findById(cls._id).populate('department coordinator');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Class already exists for this department.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST seed default classes for a department
router.post('/seed', auth, authorize('admin', 'hod', 'coordinator'), async (req, res) => {
  try {
    const { departmentId, divisions = 3 } = req.body;
    if (!departmentId) return res.status(400).json({ message: 'departmentId is required.' });

    const years = ['FE', 'SE', 'TE', 'BE'];
    const semesterMap = { FE: 2, SE: 4, TE: 6, BE: 8 };
    const created = [];

    for (const year of years) {
      for (let div = 1; div <= divisions; div++) {
        const name = `${year}${div}`;
        const exists = await Class.findOne({ name, department: departmentId });
        if (!exists) {
          const cls = new Class({
            name,
            year,
            divisionNumber: div,
            department: departmentId,
            semester: semesterMap[year],
            batchCount: 4,
            batchLabels: ['B1', 'B2', 'B3', 'B4'],
            isActive: true
          });
          await cls.save();
          created.push(cls);
        }
      }
    }

    res.status(201).json({ message: `Created ${created.length} classes.`, classes: created });
  } catch (error) {
    console.error('Class seed error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT update class
router.put('/:id', auth, authorize('admin', 'hod', 'coordinator'), async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('department coordinator');
    if (!cls) return res.status(404).json({ message: 'Class not found.' });
    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE class
router.delete('/:id', auth, authorize('admin', 'hod'), async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: 'Class deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

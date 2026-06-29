const express = require('express');
const Subject = require('../models/Subject');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { department, semester, semesters, year } = req.query;
    const filter = { isActive: true };
    if (department) filter.department = department;

    // Year-to-semester mapping
    const yearToSemMap = { FE: [1, 2], SE: [3, 4], TE: [5, 6], BE: [7, 8] };

    if (year && yearToSemMap[year.toUpperCase()]) {
      filter.semester = { $in: yearToSemMap[year.toUpperCase()] };
    } else if (semesters) {
      // Support comma-separated semesters: ?semesters=5,6
      const semList = semesters.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (semList.length > 0) filter.semester = { $in: semList };
    } else if (semester) {
      filter.semester = parseInt(semester);
    }

    const subjects = await Subject.find(filter).populate('department faculty');
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/', auth, authorize('admin', 'hod', 'coordinator'), async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    const populated = await Subject.findById(subject._id).populate('department faculty');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject code already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/:id', auth, authorize('admin', 'hod', 'coordinator'), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('department faculty');
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', auth, authorize('admin', 'hod', 'coordinator'), async (req, res) => {
  try {
    await Subject.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Subject deactivated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

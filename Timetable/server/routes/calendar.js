const express = require('express');
const AcademicCalendar = require('../models/AcademicCalendar');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const calendars = await AcademicCalendar.find().populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json(calendars);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findOne({ isActive: true });
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/', auth, authorize('dean', 'admin'), async (req, res) => {
  try {
    await AcademicCalendar.updateMany({}, { isActive: false });
    const calendar = new AcademicCalendar({ ...req.body, createdBy: req.user._id, isActive: true });
    await calendar.save();
    const io = req.app.get('io');
    io.emit('calendar-updated', calendar);
    res.status(201).json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/:id', auth, authorize('dean', 'admin'), async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!calendar) return res.status(404).json({ message: 'Calendar not found.' });
    const io = req.app.get('io');
    io.emit('calendar-updated', calendar);
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/:id/holidays', auth, authorize('dean', 'admin'), async (req, res) => {
  try {
    const calendar = await AcademicCalendar.findById(req.params.id);
    if (!calendar) return res.status(404).json({ message: 'Calendar not found.' });
    calendar.holidays.push(req.body);
    await calendar.save();
    res.json(calendar);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

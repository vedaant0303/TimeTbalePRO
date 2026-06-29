const express = require('express');
const Department = require('../models/Department');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).populate('hod coordinator');
    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const department = new Department(req.body);
    await department.save();
    res.status(201).json(department);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Department code already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('hod coordinator');
    if (!department) return res.status(404).json({ message: 'Department not found.' });
    res.json(department);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await Department.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Department deactivated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

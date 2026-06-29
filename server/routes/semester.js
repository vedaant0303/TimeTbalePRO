const express = require('express');
const SemesterConfig = require('../models/SemesterConfig');
const { auth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const router = express.Router();

// GET all semester configs
router.get('/', auth, async (req, res) => {
  try {
    const configs = await SemesterConfig.find()
      .populate('departments createdBy')
      .sort({ createdAt: -1 });
    res.json(configs);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET active semester config
router.get('/active', auth, async (req, res) => {
  try {
    const config = await SemesterConfig.findOne({ isActive: true })
      .populate('departments createdBy');
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET single semester config
router.get('/:id', auth, async (req, res) => {
  try {
    const config = await SemesterConfig.findById(req.params.id)
      .populate('departments createdBy stateHistory.changedBy');
    if (!config) return res.status(404).json({ message: 'Semester config not found.' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST create semester config
router.post('/', auth, requirePermission('semester:create'), async (req, res) => {
  try {
    // Deactivate existing
    await SemesterConfig.updateMany({}, { isActive: false });

    const config = new SemesterConfig({
      ...req.body,
      createdBy: req.user._id,
      isActive: true,
      generationState: 'semester_init',
      stateHistory: [{
        state: 'semester_init',
        changedBy: req.user._id,
        changedAt: new Date(),
        note: 'Semester setup initiated'
      }]
    });
    await config.save();

    const io = req.app.get('io');
    io.emit('semester-state-changed', {
      semesterId: config._id,
      newState: config.generationState,
      changedBy: req.user.name
    });

    const populated = await SemesterConfig.findById(config._id).populate('departments createdBy');
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This semester/year combination already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT advance state
router.put('/:id/state', auth, requirePermission('semester:advanceState'), async (req, res) => {
  try {
    const { newState, note } = req.body;
    const config = await SemesterConfig.findById(req.params.id);
    if (!config) return res.status(404).json({ message: 'Semester config not found.' });

    if (!config.canTransitionTo(newState)) {
      return res.status(400).json({
        message: `Cannot transition from '${config.generationState}' to '${newState}'`,
        currentState: config.generationState,
        allowedTransitions: SemesterConfig.STATE_TRANSITIONS[config.generationState] || []
      });
    }

    config.transitionTo(newState, req.user._id, note);
    await config.save();

    const io = req.app.get('io');
    io.emit('semester-state-changed', {
      semesterId: config._id,
      newState: config.generationState,
      changedBy: req.user.name
    });

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT update semester config (dates, departments)
router.put('/:id', auth, requirePermission('semester:create'), async (req, res) => {
  try {
    if (req.body.isActive === true) {
      await SemesterConfig.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    }
    const config = await SemesterConfig.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('departments createdBy');
    if (!config) return res.status(404).json({ message: 'Semester config not found.' });

    if (req.body.isActive === true) {
      const io = req.app.get('io');
      io.emit('semester-state-changed', {
        semesterId: config._id,
        newState: config.generationState,
        changedBy: req.user.name
      });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

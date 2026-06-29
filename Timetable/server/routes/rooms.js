const express = require('express');
const Room = require('../models/Room');
const TimetableEntry = require('../models/TimetableEntry');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { type, department, isShared } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (department) filter.department = department;
    if (isShared !== undefined) filter.isShared = isShared === 'true';
    const rooms = await Room.find(filter).populate('department').populate('sharedWith.deptId', 'name code').sort({ name: 1 });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/rooms/availability - Real-time room availability
router.get('/availability', auth, async (req, res) => {
  try {
    const { day, timeSlotId, academicYear } = req.query;
    const rooms = await Room.find({ isActive: true });
    const occupiedEntries = await TimetableEntry.find({
      day, timeSlot: timeSlotId, academicYear
    }).select('room');
    const occupiedRoomIds = occupiedEntries.map(e => e.room.toString());
    const availability = rooms.map(room => ({
      ...room.toObject(),
      isAvailable: !occupiedRoomIds.includes(room._id.toString())
    }));
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/', auth, authorize('admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const data = { ...req.body };
    // Normalize sharedWith
    if (data.isShared && Array.isArray(data.sharedWith)) {
      data.sharedWith = data.sharedWith.map(sw => ({
        deptId: sw.deptId || sw,
        percentage: sw.percentage || 50
      }));
    } else {
      data.sharedWith = [];
    }
    const room = new Room(data);
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Room code already exists.' });
    }
    console.error('POST /rooms error:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/:id', auth, authorize('admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const { name, code, roomNumber, building, floor, capacity, type, facilities, department, isShared, sharedWith, isActive } = req.body;
    const update = { name, code, roomNumber, building, floor, capacity, type, facilities, isActive };
    if (department) update.department = department;
    else update.$unset = { department: 1 };
    update.isShared = !!isShared;
    update.sharedWith = isShared && Array.isArray(sharedWith) ? sharedWith.map(sw => ({
      deptId: sw.deptId || sw,
      percentage: sw.percentage || 50
    })) : [];
    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    res.json(room);
  } catch (error) {
    console.error('PUT /rooms error:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', auth, authorize('admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    await Room.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Room deactivated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

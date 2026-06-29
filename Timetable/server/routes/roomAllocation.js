const express = require('express');
const RoomAllocation = require('../models/RoomAllocation');
const Room = require('../models/Room');
const { auth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const router = express.Router();

// GET allocation for a department + semester
router.get('/:deptId/:semId', auth, async (req, res) => {
  try {
    let alloc = await RoomAllocation.findOne({
      departmentId: req.params.deptId,
      semesterId: req.params.semId
    }).populate('rooms.roomId rooms.sharedWithDeptId batchConfig.classId');

    if (!alloc) {
      // Auto-create with all rooms accessible
      const rooms = await Room.find({ isActive: true });
      alloc = new RoomAllocation({
        semesterId: req.params.semId,
        departmentId: req.params.deptId,
        rooms: rooms.map(r => ({
          roomId: r._id,
          isAccessible: true,
          sharingPercentage: 100
        }))
      });
      await alloc.save();
      alloc = await RoomAllocation.findById(alloc._id)
        .populate('rooms.roomId rooms.sharedWithDeptId batchConfig.classId');
    }

    res.json(alloc);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST set allocation (full save)
router.post('/', auth, requirePermission('rooms:setAllocation'), async (req, res) => {
  try {
    const { semesterId, departmentId, rooms: rawRooms, batchConfig } = req.body;

    // Clean empty ObjectId refs
    const rooms = (rawRooms || []).map(r => ({
      roomId: r.roomId,
      isAccessible: r.isAccessible,
      sharingPercentage: r.sharingPercentage || 100,
      ...(r.sharedWithDeptId ? { sharedWithDeptId: r.sharedWithDeptId } : {})
    }));

    let alloc = await RoomAllocation.findOne({ departmentId, semesterId });
    if (alloc) {
      alloc.rooms = rooms;
      alloc.batchConfig = batchConfig || alloc.batchConfig;
    } else {
      alloc = new RoomAllocation({ semesterId, departmentId, rooms, batchConfig });
    }

    await alloc.calculateSummary();
    await alloc.save();

    const populated = await RoomAllocation.findById(alloc._id)
      .populate('rooms.roomId rooms.sharedWithDeptId batchConfig.classId');

    const io = req.app.get('io');
    io.emit('room-allocation-updated', { departmentId, semesterId });

    res.json(populated);
  } catch (error) {
    console.error('Room allocation save error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT toggle room accessibility
router.put('/toggle/:allocId/room/:roomId', auth, requirePermission('rooms:setAccessibility'), async (req, res) => {
  try {
    const alloc = await RoomAllocation.findById(req.params.allocId);
    if (!alloc) return res.status(404).json({ message: 'Allocation not found.' });

    const roomEntry = alloc.rooms.find(r => r.roomId.toString() === req.params.roomId);
    if (!roomEntry) return res.status(404).json({ message: 'Room not found in allocation.' });

    roomEntry.isAccessible = !roomEntry.isAccessible;
    if (req.body.sharingPercentage !== undefined) {
      roomEntry.sharingPercentage = req.body.sharingPercentage;
    }
    if (req.body.sharedWithDeptId !== undefined) {
      roomEntry.sharedWithDeptId = req.body.sharedWithDeptId;
    }

    await alloc.calculateSummary();
    await alloc.save();

    res.json(alloc);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

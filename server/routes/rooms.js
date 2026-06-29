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

// GET /api/rooms/availability - Real-time room availability based on current time
router.get('/availability', auth, async (req, res) => {
  try {
    const { academicYear, currentTime, day } = req.query;
    if (!academicYear || !day) {
      return res.status(400).json({ message: 'academicYear and day are required.' });
    }

    const TimeSlot = require('../models/TimeSlot');

    // Parse currentTime (e.g. '10:30') to minutes for comparison
    const parseToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1] || '0', 10);
      if (h >= 1 && h <= 6) h += 12; // 1-6 treated as PM
      return h * 60 + m;
    };

    const nowMinutes = currentTime ? parseToMinutes(currentTime) : 0;

    // Find all active time slots for this academic year (across all departments)
    const allTimeSlots = await TimeSlot.find({ academicYear, isActive: true, isBreak: false });

    // Find which time slots are currently active (currentTime is within startTime-endTime)
    const activeSlotIds = allTimeSlots
      .filter(ts => {
        const start = parseToMinutes(ts.startTime);
        const end = parseToMinutes(ts.endTime);
        return nowMinutes >= start && nowMinutes < end;
      })
      .map(ts => ts._id);

    // Get all rooms
    const rooms = await Room.find({ isActive: true })
      .populate('department', 'name code')
      .sort({ type: 1, name: 1 });

    // If no active slots or no currentTime, all rooms are free
    if (activeSlotIds.length === 0 || !currentTime) {
      return res.json({
        currentTime: currentTime || null,
        day,
        activeSlotCount: 0,
        rooms: rooms.map(r => ({
          _id: r._id,
          name: r.name,
          code: r.code,
          type: r.type,
          capacity: r.capacity,
          building: r.building,
          floor: r.floor,
          facilities: r.facilities,
          department: r.department,
          status: 'free',
          occupiedBy: null
        }))
      });
    }

    // Find all TimetableEntry records for this day + active time slots
    const occupiedEntries = await TimetableEntry.find({
      day,
      timeSlot: { $in: activeSlotIds },
      academicYear
    })
      .populate('subject', 'code name')
      .populate('faculty', 'name')
      .populate('department', 'name code')
      .populate('room', '_id')
      .lean();

    // Build a map of roomId -> occupation info
    const roomOccupancy = {};
    for (const entry of occupiedEntries) {
      const roomId = entry.room?._id?.toString();
      if (!roomId) continue;
      if (!roomOccupancy[roomId]) {
        roomOccupancy[roomId] = [];
      }
      roomOccupancy[roomId].push({
        subject: entry.subject?.code || entry.subject?.name || '—',
        faculty: entry.faculty?.name || '—',
        department: entry.department?.code || entry.department?.name || '—',
        type: entry.type,
        division: entry.division,
        semester: entry.semester,
        batch: entry.batch || null
      });
    }

    // Also check TimetableSlot (new system)
    const TimetableSlot = require('../models/TimetableSlot');
    const activeStartTimes = allTimeSlots
      .filter(ts => {
        const start = parseToMinutes(ts.startTime);
        const end = parseToMinutes(ts.endTime);
        return nowMinutes >= start && nowMinutes < end;
      })
      .map(ts => ts.startTime);

    if (activeStartTimes.length > 0) {
      const newEntries = await TimetableSlot.find({
        day,
        startTime: { $in: activeStartTimes }
      }).populate('department', 'name code').lean();

      for (const entry of newEntries) {
        const roomId = entry.roomId?.toString();
        if (!roomId) continue;
        if (!roomOccupancy[roomId]) roomOccupancy[roomId] = [];
        roomOccupancy[roomId].push({
          subject: entry.subjectCode || entry.subjectName || '—',
          faculty: '—',
          department: entry.department?.code || '—',
          type: entry.slotType || 'theory',
          division: null,
          semester: null,
          batch: entry.batch || null
        });
      }
    }

    // Compose response
    const result = rooms.map(r => {
      const occ = roomOccupancy[r._id.toString()];
      return {
        _id: r._id,
        name: r.name,
        code: r.code,
        type: r.type,
        capacity: r.capacity,
        building: r.building,
        floor: r.floor,
        facilities: r.facilities,
        department: r.department,
        status: occ && occ.length > 0 ? 'occupied' : 'free',
        occupiedBy: occ && occ.length > 0 ? occ : null
      };
    });

    // Get the active slot time range for display
    const activeSlotDetails = allTimeSlots
      .filter(ts => {
        const start = parseToMinutes(ts.startTime);
        const end = parseToMinutes(ts.endTime);
        return nowMinutes >= start && nowMinutes < end;
      })
      .map(ts => ({ startTime: ts.startTime, endTime: ts.endTime }));

    res.json({
      currentTime,
      day,
      activeSlotCount: activeSlotIds.length,
      activeSlots: activeSlotDetails,
      rooms: result
    });
  } catch (error) {
    console.error('Room availability error:', error);
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
    const { name, code, roomNumber, building, floor, capacity, type, facilities, department, isShared, sharedWith, isSharedBatch, sharedBatchName, isActive } = req.body;
    const update = { name, code, roomNumber, building, floor, capacity, type, facilities, isActive };
    if (department) update.department = department;
    else update.$unset = { department: 1 };
    update.isShared = !!isShared;
    update.sharedWith = isShared && Array.isArray(sharedWith) ? sharedWith.map(sw => ({
      deptId: sw.deptId || sw,
      percentage: sw.percentage || 50
    })) : [];
    update.isSharedBatch = !!isSharedBatch;
    update.sharedBatchName = isSharedBatch ? sharedBatchName || '' : '';
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

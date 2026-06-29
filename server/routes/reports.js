const express = require('express');
const TimetableEntry = require('../models/TimetableEntry');
const Room = require('../models/Room');
const Subject = require('../models/Subject');
const Department = require('../models/Department');
const TimeSlot = require('../models/TimeSlot');
const AuditLog = require('../models/AuditLog');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/reports/utilization - Room utilization report (dynamic)
router.get('/utilization', auth, authorize('principal', 'dean', 'admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const { academicYear } = req.query;
    const rooms = await Room.find({ isActive: true }).populate('department', 'name code').sort({ code: 1 });
    const entries = await TimetableEntry.find({ academicYear }).select('room day timeSlot type');

    // Calculate actual total available slots: 5 days × non-break time slots
    const activeSlots = await TimeSlot.countDocuments({
      academicYear: academicYear || '2025-2026',
      isBreak: false
    });
    const totalAvailableSlots = activeSlots * 5; // 5 weekdays

    const utilization = rooms.map(room => {
      const roomEntries = entries.filter(e =>
        e.room && e.room.toString() === room._id.toString()
      );
      const theoryCount = roomEntries.filter(e => e.type === 'theory').length;
      const practicalCount = roomEntries.filter(e => e.type === 'practical').length;
      const otherCount = roomEntries.length - theoryCount - practicalCount;

      // Count unique day+slot combinations (some entries may overlap for batch practicals)
      const uniqueSlots = new Set(roomEntries.map(e => `${e.day}-${e.timeSlot}`));

      return {
        room: {
          _id: room._id,
          code: room.code,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          department: room.department?.code || ''
        },
        usedSlots: uniqueSlots.size,
        totalSlots: totalAvailableSlots,
        theoryCount,
        practicalCount,
        otherCount,
        totalEntries: roomEntries.length,
        utilization: totalAvailableSlots > 0
          ? ((uniqueSlots.size / totalAvailableSlots) * 100).toFixed(1)
          : '0.0'
      };
    });

    // Sort by utilization descending
    utilization.sort((a, b) => parseFloat(b.utilization) - parseFloat(a.utilization));

    res.json(utilization);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/reports/department-summary (dynamic, uses real data)
router.get('/department-summary', auth, authorize('principal', 'dean', 'admin', 'coordinator', 'hod'), async (req, res) => {
  try {
    const { academicYear } = req.query;
    const departments = await Department.find({ isActive: true }).sort({ name: 1 });

    // Get Faculty model
    const Faculty = require('../models/Faculty');

    const summary = [];
    for (const dept of departments) {
      const entries = await TimetableEntry.find({ department: dept._id, academicYear });
      const subjects = await Subject.find({ department: dept._id, isActive: true });

      // Count faculty from Faculty collection (separate from User)
      const facultyCount = await Faculty.countDocuments({
        $or: [{ department: dept._id }, { departments: dept._id }]
      });

      // Count unique semesters
      const semesters = [...new Set(entries.map(e => e.semester).filter(Boolean))];
      const divisions = [...new Set(entries.map(e => e.division).filter(Boolean))];

      // Count clashes for this department
      const unassignedCount = entries.filter(e => !e.faculty).length;
      const practicalCount = entries.filter(e => e.type === 'practical').length;
      const theoryCount = entries.filter(e => e.type === 'theory').length;

      // Determine status
      let status = 'not started';
      if (entries.length > 0) {
        const hasLocked = entries.some(e => e.isLocked);
        const hasDraft = entries.some(e => e.status === 'draft');
        status = hasLocked ? 'published' : hasDraft ? 'draft' : entries[0].status || 'draft';
      }

      summary.push({
        department: { _id: dept._id, name: dept.name, code: dept.code },
        totalEntries: entries.length,
        totalFaculty: facultyCount,
        totalSubjects: subjects.length,
        semesters: semesters.sort(),
        divisions: divisions.sort(),
        theoryCount,
        practicalCount,
        unassignedCount,
        status
      });
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/reports/audit-log
router.get('/audit-log', auth, authorize('admin', 'principal'), async (req, res) => {
  try {
    const { entity, user: userId, limit = 100 } = req.query;
    const filter = {};
    if (entity) filter.entity = entity;
    if (userId) filter.user = userId;
    const logs = await AuditLog.find(filter)
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/reports/overview — Quick stats for dashboard
router.get('/overview', auth, async (req, res) => {
  try {
    const { academicYear } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;

    const totalEntries = await TimetableEntry.countDocuments(filter);
    const totalRooms = await Room.countDocuments({ isActive: true });
    const totalSubjects = await Subject.countDocuments({ isActive: true });
    const totalDepts = await Department.countDocuments({ isActive: true });

    const Faculty = require('../models/Faculty');
    const totalFaculty = await Faculty.countDocuments({});

    const Student = require('../models/Student');
    const totalStudents = await Student.countDocuments({ isActive: true });

    res.json({
      totalEntries, totalRooms, totalSubjects,
      totalDepts, totalFaculty, totalStudents
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/reports/archive
router.post('/archive', auth, authorize('admin'), async (req, res) => {
  try {
    const { academicYear } = req.body;
    const count = await TimetableEntry.countDocuments({ academicYear });
    await TimetableEntry.deleteMany({ academicYear });
    res.json({ message: `Archived ${count} entries for academic year ${academicYear}.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

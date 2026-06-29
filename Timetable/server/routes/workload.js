const express = require('express');
const TimetableEntry = require('../models/TimetableEntry');
const TimetableSlot = require('../models/TimetableSlot');
const FacultyWorkload = require('../models/FacultyWorkload');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const { auth, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const router = express.Router();

// GET /api/workload - Faculty workload summary (from computed or FacultyWorkload collection)
router.get('/', auth, authorize('principal', 'dean', 'hod', 'coordinator', 'admin'), async (req, res) => {
  try {
    const { department, academicYear, semesterId } = req.query;

    // Auto-find active semester if not provided
    let semId = semesterId;
    if (!semId) {
      const SemesterConfig = require('../models/SemesterConfig');
      const activeSem = await SemesterConfig.findOne({ isActive: true });
      if (activeSem) semId = activeSem._id.toString();
    }

    // Try FacultyWorkload collection first
    if (semId) {
      const query = { semesterId: semId };
      
      // Filter by department: use workload's own department field first
      if (department) {
        // Find workloads that either: (1) have matching department field, or (2) have no department field (old records)
        query.$or = [
          { department: department },
          { department: { $exists: false } },
          { department: null }
        ];
      }

      let workloads = await FacultyWorkload.find(query)
        .populate('facultyId allocations.classId allocations.subjectId')
        .sort({ totalTeachingLoad: -1 });

      // For old records without department field, filter by faculty's department
      if (department && workloads.length > 0) {
        const deptFaculty = await Faculty.find({
          $or: [{ department: department }, { departments: department }]
        }).select('_id');
        const deptUsers = await User.find({ department: department, role: 'faculty' }).select('_id');
        const allowedIds = new Set([
          ...deptFaculty.map(f => f._id.toString()),
          ...deptUsers.map(u => u._id.toString())
        ]);

        workloads = workloads.filter(w => {
          // If workload has matching department, always include
          if (w.department?.toString() === department) return true;
          // If workload has a different department set, exclude
          if (w.department) return false;
          // No department set (old record) — check faculty's department
          const fId = w.facultyId?._id?.toString() || w.facultyId?.toString();
          const belongs = allowedIds.has(fId);
          // Backfill department on old records that match
          if (belongs) {
            FacultyWorkload.updateOne({ _id: w._id }, { department }).catch(() => {});
          }
          return belongs;
        });
      }

      // Fix: If facultyId didn't populate from Faculty model, try User model
      for (const wl of workloads) {
        if (!wl.facultyId?.name && wl.facultyId) {
          const rawId = wl.facultyId._id?.toString() || wl.facultyId.toString();
          const userDoc = await User.findById(rawId).select('name email designation');
          if (userDoc) {
            wl.facultyId = { _id: rawId, name: userDoc.name, email: userDoc.email, designation: userDoc.designation || 'Faculty' };
          }
        }
      }
      return res.json(workloads);
    }

    // Fallback: compute from timetable entries
    const filter = {};
    if (department) filter.department = department;
    if (academicYear) filter.academicYear = academicYear;

    const entries = await TimetableEntry.find(filter).populate('faculty subject');
    const facultyMap = {};

    entries.forEach(entry => {
      const fId = entry.faculty?._id?.toString();
      if (!fId) return;
      if (!facultyMap[fId]) {
        facultyMap[fId] = {
          faculty: entry.faculty,
          totalHours: 0,
          subjects: new Set(),
          dayWise: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 }
        };
      }
      facultyMap[fId].totalHours++;
      facultyMap[fId].subjects.add(entry.subject?.name);
      facultyMap[fId].dayWise[entry.day]++;
    });

    const workload = Object.values(facultyMap).map(w => ({
      ...w,
      subjects: Array.from(w.subjects),
      isOverloaded: w.totalHours > (w.faculty?.maxWeeklyHours || 20)
    }));

    res.json(workload);
  } catch (error) {
    console.error('Workload error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET workload for a specific semester (new system)
router.get('/semester/:semId', auth, async (req, res) => {
  try {
    const { department } = req.query;
    const filter = { semesterId: req.params.semId };

    const workloads = await FacultyWorkload.find(filter)
      .populate('facultyId allocations.classId allocations.subjectId')
      .sort({ totalTeachingLoad: -1 });

    res.json(workloads);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/workload - Create or update faculty workload
router.post('/', auth, requirePermission('workload:upload'), async (req, res) => {
  try {
    const { facultyId, semesterId, allocations, miniProjectLoad, majorProjectLoad, department } = req.body;
    // Use provided department, or fall back to user's own department
    const deptId = department || req.user.department?._id || req.user.department;

    let workload = await FacultyWorkload.findOne({ facultyId, semesterId });
    if (workload) {
      workload.allocations = allocations;
      workload.miniProjectLoad = miniProjectLoad || 0;
      workload.majorProjectLoad = majorProjectLoad || 0;
      // Backfill department if missing
      if (!workload.department && deptId) workload.department = deptId;
    } else {
      workload = new FacultyWorkload({
        facultyId, semesterId, allocations,
        department: deptId,
        miniProjectLoad: miniProjectLoad || 0,
        majorProjectLoad: majorProjectLoad || 0
      });
    }

    workload.calculateTotals();
    await workload.save();

    const populated = await FacultyWorkload.findById(workload._id)
      .populate('facultyId allocations.classId allocations.subjectId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// POST /api/workload/bulk - Create workloads for multiple faculty at once
router.post('/bulk', auth, requirePermission('workload:upload'), async (req, res) => {
  try {
    const { semesterId, workloads } = req.body;
    const results = [];

    for (const wl of workloads) {
      let workload = await FacultyWorkload.findOne({ facultyId: wl.facultyId, semesterId });
      if (workload) {
        workload.allocations = wl.allocations;
        workload.miniProjectLoad = wl.miniProjectLoad || 0;
        workload.majorProjectLoad = wl.majorProjectLoad || 0;
      } else {
        workload = new FacultyWorkload({ ...wl, semesterId });
      }
      workload.calculateTotals();
      await workload.save();
      results.push(workload);
    }

    res.status(201).json({ message: `${results.length} workloads saved.`, count: results.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT submit workload
router.put('/:id/submit', auth, requirePermission('workload:upload'), async (req, res) => {
  try {
    const workload = await FacultyWorkload.findByIdAndUpdate(req.params.id, {
      status: 'submitted',
      submittedBy: req.user._id,
      submittedAt: new Date()
    }, { new: true }).populate('facultyId');
    if (!workload) return res.status(404).json({ message: 'Workload not found.' });
    res.json(workload);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// PUT approve workload
router.put('/:id/approve', auth, requirePermission('workload:approve'), async (req, res) => {
  try {
    const workload = await FacultyWorkload.findByIdAndUpdate(req.params.id, {
      status: 'approved',
      approvedBy: req.user._id,
      approvedAt: new Date()
    }, { new: true }).populate('facultyId');
    if (!workload) return res.status(404).json({ message: 'Workload not found.' });
    res.json(workload);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/workload/faculty/:id
router.get('/faculty/:id', auth, async (req, res) => {
  try {
    const { academicYear, semesterId } = req.query;

    // Try new system
    if (semesterId) {
      const workload = await FacultyWorkload.findOne({ facultyId: req.params.id, semesterId })
        .populate('facultyId allocations.classId allocations.subjectId');
      if (workload) return res.json(workload);
    }

    // Fallback
    const filter = { faculty: req.params.id };
    if (academicYear) filter.academicYear = academicYear;

    const entries = await TimetableEntry.find(filter)
      .populate('subject room department timeSlot')
      .sort({ day: 1 });

    const totalHours = entries.length;
    const faculty = await User.findById(req.params.id);
    const dayWise = {};
    entries.forEach(e => {
      if (!dayWise[e.day]) dayWise[e.day] = [];
      dayWise[e.day].push(e);
    });

    res.json({
      faculty,
      totalHours,
      maxWeeklyHours: faculty?.maxWeeklyHours || 20,
      isOverloaded: totalHours > (faculty?.maxWeeklyHours || 20),
      dayWise,
      entries
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE single faculty workload
router.delete('/:id', auth, requirePermission('workload:upload'), async (req, res) => {
  try {
    const workload = await FacultyWorkload.findByIdAndDelete(req.params.id);
    if (!workload) return res.status(404).json({ message: 'Workload not found.' });
    res.json({ message: 'Workload deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// DELETE all workload for a semester (optional department filter)
router.delete('/clear/all', auth, requirePermission('workload:upload'), async (req, res) => {
  try {
    const { semesterId, department } = req.query;
    const filter = {};
    if (semesterId) filter.semesterId = semesterId;
    
    // If department specified, only delete for that department's faculty
    if (department) {
      const deptFaculty = await Faculty.find({ departments: department }).select('_id');
      const deptFacultyIds = deptFaculty.map(f => f._id);
      filter.facultyId = { $in: deptFacultyIds };
    }
    
    const result = await FacultyWorkload.deleteMany(filter);
    res.json({ message: `Deleted ${result.deletedCount} workload records.`, count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

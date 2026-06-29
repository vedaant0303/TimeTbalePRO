const express = require('express');
const TimetableSlot = require('../models/TimetableSlot');
const TimetableEntry = require('../models/TimetableEntry');
const Approval = require('../models/Approval');
const AuditLog = require('../models/AuditLog');
const Room = require('../models/Room');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Student = require('../models/Student');
const TimeSlot = require('../models/TimeSlot');
const SemesterConfig = require('../models/SemesterConfig');
const SubjectAllocation = require('../models/SubjectAllocation');
const FacultyWorkload = require('../models/FacultyWorkload');
const Faculty = require('../models/Faculty');
const { auth, authorize } = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');
const { generateTimetable } = require('../services/timetableGenerator');
const router = express.Router();

// ─── AUTO-SYNC: Recalculate faculty workload from timetable entries ───
async function syncFacultyWorkloadFromTimetable(facultyId, io) {
  if (!facultyId) return;
  try {
    const activeSem = await SemesterConfig.findOne({ isActive: true });
    if (!activeSem) return;

    // Get all timetable entries for this faculty
    const entries = await TimetableEntry.find({ faculty: facultyId })
      .populate('subject', 'name code')
      .populate('department', '_id name')
      .populate('timeSlot', 'startTime endTime duration');

    // Group by subject + class (division+semester) + type
    const allocMap = {}; // key: subjectId_className_type
    let department = null;

    for (const e of entries) {
      if (!e.subject) continue;
      if (!department && e.department) department = e.department._id;

      const subjId = e.subject._id.toString();
      const className = `${e.division ? 'Div-' + e.division : ''}${e.semester ? ' Sem-' + e.semester : ''}`.trim();
      const key = `${subjId}_${className}`;

      if (!allocMap[key]) {
        allocMap[key] = {
          subjectId: e.subject._id,
          subjectCode: e.subject.code || e.subject.name,
          subjectName: e.subject.name,
          className: className || e.division || '',
          semester: e.semester || 0,
          theoryLoad: 0,
          practicalLoad: { batch1: 0, batch2: 0, batch3: 0, batch4: 0 },
          totalLoad: 0
        };
      }

      // Count hours: estimate from slot duration or count slots
      const hours = e.timeSlot?.duration ? Math.round(e.timeSlot.duration / 60) : 1;

      if (e.type === 'theory' || e.type === 'lecture') {
        allocMap[key].theoryLoad += hours;
      } else if (e.type === 'practical' || e.type === 'lab') {
        const batchNum = parseInt(e.batch?.replace(/\D/g, '')) || 0;
        if (batchNum === 1) allocMap[key].practicalLoad.batch1 += hours;
        else if (batchNum === 2) allocMap[key].practicalLoad.batch2 += hours;
        else if (batchNum === 3) allocMap[key].practicalLoad.batch3 += hours;
        else if (batchNum === 4) allocMap[key].practicalLoad.batch4 += hours;
        else allocMap[key].practicalLoad.batch1 += hours; // Default to batch 1
      } else if (e.type === 'project' || e.type === 'mini-project') {
        // Count as project load separately
        allocMap[key].theoryLoad += hours;
      } else {
        allocMap[key].theoryLoad += hours;
      }
    }

    const allocations = Object.values(allocMap);

    // Upsert workload
    let wl = await FacultyWorkload.findOne({ facultyId, semesterId: activeSem._id });
    if (wl) {
      // Merge: update allocations from timetable, keep existing extra fields
      wl.allocations = allocations;
      if (department) wl.department = department;
      wl.calculateTotals();
      await wl.save();
    } else if (allocations.length > 0) {
      wl = new FacultyWorkload({
        facultyId, semesterId: activeSem._id,
        department: department || null,
        allocations,
        miniProjectLoad: 0, majorProjectLoad: 0,
        status: 'draft'
      });
      wl.calculateTotals();
      await wl.save();
    }

    // Emit real-time update
    if (io && wl) {
      io.emit('workload-updated', { facultyId: facultyId.toString(), workload: wl });
    }

    console.log(`[WorkloadSync] Faculty ${facultyId}: ${allocations.length} allocations, total=${wl?.totalTeachingLoad || 0}`);
  } catch (err) {
    console.error('[WorkloadSync] Error:', err.message);
  }
}

function isEntryInSharedBatch(entry, sharedBatchName, className) {
  if (!sharedBatchName) return false;
  const parts = sharedBatchName.split(' - ');
  if (parts.length !== 2) return false;
  const batchClassName = parts[0];
  const batchesStr = parts[1];
  const allowedBatches = batchesStr.split(' + ').map(b => b.trim());

  if (className !== batchClassName) return false;
  
  const targetBatch = entry.batch || entry.combinedBatches;
  if (!targetBatch) return false;
  
  const entryBatches = Array.isArray(targetBatch) 
    ? targetBatch 
    : targetBatch.split(/[+\s]+/).map(b => b.trim()).filter(Boolean);
    
  return entryBatches.every(b => allowedBatches.includes(b));
}

// ─── CLASH DETECTION ────────────────────────────────────────
async function detectClashes(entry, excludeId = null) {
  const clashes = [];
  const baseQuery = {
    day: entry.day,
    startTime: entry.startTime,
    semesterId: entry.semesterId
  };
  if (excludeId) baseQuery._id = { $ne: excludeId };

  // Faculty clash
  if (entry.facultyId) {
    const facultyClash = await TimetableSlot.findOne({ ...baseQuery, facultyId: entry.facultyId });
    if (facultyClash) {
      clashes.push({ type: 'faculty', message: 'Faculty already assigned at this time', conflict: facultyClash });
    }
  }

  // Room clash
  if (entry.roomId) {
    const roomClash = await TimetableSlot.findOne({ ...baseQuery, roomId: entry.roomId });
    if (roomClash) {
      // Check shared batch room bypass
      const Room = require('../models/Room');
      const roomDoc = await Room.findById(entry.roomId);
      if (roomDoc && roomDoc.isSharedBatch && roomDoc.sharedBatchName) {
        const ClassModel = require('../models/Class');
        const entryClass = await ClassModel.findById(entry.classId);
        const clashClass = await ClassModel.findById(roomClash.classId);
        
        const isEntryMatch = entryClass && isEntryInSharedBatch(entry, roomDoc.sharedBatchName, entryClass.name);
        const isClashMatch = clashClass && isEntryInSharedBatch(roomClash, roomDoc.sharedBatchName, clashClass.name);
        
        if (isEntryMatch && isClashMatch) {
          // Bypass conflict — both entries belong to the same combined batch group allowed for this room
        } else {
          clashes.push({ type: 'room', message: 'Room already occupied at this time', conflict: roomClash });
        }
      } else {
        clashes.push({ type: 'room', message: 'Room already occupied at this time', conflict: roomClash });
      }
    }
  }

  // Class + batch clash
  const classQuery = { ...baseQuery, classId: entry.classId };
  if (entry.batch) {
    classQuery.$or = [{ batch: entry.batch }, { batch: null }];
  } else {
    // Theory = no batch, clashes with everything in that class
  }
  const classClash = await TimetableSlot.findOne(classQuery);
  if (classClash) {
    clashes.push({ type: 'class', message: 'Class/batch already has a slot at this time', conflict: classClash });
  }

  return clashes;
}

// ─── MASTER TIMETABLE (all semesters + divisions) ─────────────
router.get('/master', auth, async (req, res) => {
  try {
    const { academicYear, department } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    if (department) filter.department = department;

    const entries = await TimetableEntry.find(filter)
      .populate('subject faculty room department timeSlot createdBy lastModifiedBy')
      .sort({ day: 1, 'timeSlot.slotNumber': 1 });

    // Fallback: populate faculty from Faculty collection
    const FacultyModel = require('../models/Faculty');
    const result = [];
    for (const e of entries) {
      const obj = e.toObject();
      if (!obj.faculty?.name && obj.faculty) {
        const facDoc = await FacultyModel.findById(obj.faculty).select('name email designation');
        if (facDoc) {
          obj.faculty = { _id: facDoc._id, name: facDoc.name, email: facDoc.email };
        }
      }
      result.push(obj);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── LEGACY GET TIMETABLE (backward compat) ──────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { department, division, semester, academicYear, faculty, day } = req.query;
    const mongoose = require('mongoose');
    const filter = {};
    // Only add department filter if it's a valid ObjectId
    if (department && mongoose.Types.ObjectId.isValid(department)) filter.department = department;
    if (division) filter.division = division;
    if (semester) filter.semester = parseInt(semester);
    if (academicYear && academicYear !== 'undefined' && academicYear !== 'Not Configured') filter.academicYear = academicYear;

    // Visibility filtering: students only see published-to-students
    // Faculty: if querying their own schedule (faculty=ownId), skip visibility filter
    // If browsing department timetables without their own ID, apply visibility filter
    if (req.user.role === 'student') {
      filter.visibleToStudents = true;
    } else if (req.user.role === 'faculty' && !faculty) {
      // Faculty browsing department timetable (not their own schedule) — apply filter
      filter.visibleToFaculty = true;
    }
    // When faculty queries ?faculty=ownId, NO visibility filter — they always see their own classes
    // HOD, coordinator, principal, admin see everything
    if (day) filter.day = day;

    // Faculty filter: search by User._id, Faculty._id, and duplicate Users with same/similar email
    if (faculty) {
      const Faculty = require('../models/Faculty');
      const userDoc = await User.findById(faculty).select('email name');
      const facultyIds = [faculty];
      
      if (userDoc?.email) {
        // Extract base name from email (strip mr./ms./dr. prefix)
        const namepart = userDoc.email.split('@')[0].replace(/^ms\.|^mr\.|^dr\./, '');
        
        // Find ALL User records with same or similar email (handles duplicate accounts, prefix differences)
        const dupUsers = await User.find({
          email: { $regex: namepart, $options: 'i' }
        }).select('_id');
        dupUsers.forEach(du => {
          if (!facultyIds.includes(du._id.toString())) facultyIds.push(du._id);
        });
        
        // Find matching Faculty records by similar email
        const facDocs = await Faculty.find({ 
          email: { $regex: namepart, $options: 'i' } 
        }).select('_id');
        facDocs.forEach(fd => {
          if (!facultyIds.includes(fd._id.toString())) facultyIds.push(fd._id);
        });
      }
      
      filter.faculty = facultyIds.length === 1 ? faculty : { $in: facultyIds };
    }

    let entries = await TimetableEntry.find(filter)
      .populate('subject faculty department timeSlot createdBy lastModifiedBy')
      .populate({ path: 'room', populate: [{ path: 'department', select: 'name code' }, { path: 'sharedWith.deptId', select: 'name code' }] })
      .sort({ day: 1, 'timeSlot.slotNumber': 1 });

    // Fallback: if faculty didn't populate (ID is from Faculty collection, not User),
    // look up in Faculty collection
    const Faculty = filter.faculty ? require('../models/Faculty') : null;
    const unpopulated = entries.filter(e => e.faculty === null && e._doc?.faculty);
    if (unpopulated.length > 0 || entries.some(e => !e.faculty && e.toObject().faculty)) {
      const FacultyModel = require('../models/Faculty');
      const allFacultyIds = entries
        .map(e => e.toObject().faculty)
        .filter(id => id && !entries.find(x => x.faculty?._id?.toString() === id?.toString()));
      
      if (allFacultyIds.length > 0) {
        const facultyDocs = await FacultyModel.find({ _id: { $in: allFacultyIds } }).select('name email designation');
        const facultyMap = {};
        facultyDocs.forEach(f => { facultyMap[f._id.toString()] = f; });
        
        entries = entries.map(e => {
          const obj = e.toObject();
          if (!obj.faculty?.name && obj.faculty) {
            const facDoc = facultyMap[obj.faculty.toString()];
            if (facDoc) {
              obj.faculty = { _id: facDoc._id, name: facDoc.name, email: facDoc.email, designation: facDoc.designation };
            }
          }
          return obj;
        });
      }
    }

    res.json(entries);
  } catch (error) {
    console.error('GET /timetable error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── CLASH DETECTION FOR TIMETABLE ENTRIES ────────────────────
async function detectEntryClashes(entry, excludeId = null) {
  const clashes = [];
  const baseQuery = {
    day: entry.day,
    timeSlot: entry.timeSlot,
    academicYear: entry.academicYear
  };
  if (excludeId) baseQuery._id = { $ne: excludeId };

  // 1. Faculty clash — same faculty at same time across ALL departments
  if (entry.faculty) {
    const facultyClash = await TimetableEntry.findOne({ ...baseQuery, faculty: entry.faculty })
      .populate('subject', 'name code')
      .populate('department', 'name code')
      .populate('room', 'name code');
    if (facultyClash) {
      clashes.push({
        type: 'faculty',
        message: `Faculty already assigned to ${facultyClash.subject?.code || 'another subject'} (${facultyClash.department?.code || 'Dept'}, Div ${facultyClash.division}) at this time`,
        conflict: {
          subject: facultyClash.subject?.code,
          department: facultyClash.department?.code,
          division: facultyClash.division,
          room: facultyClash.room?.code
        }
      });
    }
  }

  // 2. Room clash — same room at same time across ALL departments
  if (entry.room) {
    const roomClash = await TimetableEntry.findOne({ ...baseQuery, room: entry.room })
      .populate('subject', 'name code')
      .populate('department', 'name code')
      .populate('faculty', 'name');
    if (roomClash) {
      // Check shared batch room bypass
      const Room = require('../models/Room');
      const roomDoc = await Room.findById(entry.room);
      if (roomDoc && roomDoc.isSharedBatch && roomDoc.sharedBatchName) {
        const ClassModel = require('../models/Class');
        
        let entryClassName = '';
        if (entry.classId) {
          const cls = await ClassModel.findById(entry.classId);
          if (cls) entryClassName = cls.name;
        } else {
          const cls = await ClassModel.findOne({ semester: entry.semester, divisionNumber: parseInt(entry.division) || entry.division, department: entry.department });
          if (cls) entryClassName = cls.name;
        }
        
        let clashClassName = '';
        if (roomClash.classId) {
          const cls = await ClassModel.findById(roomClash.classId);
          if (cls) clashClassName = cls.name;
        } else {
          const cls = await ClassModel.findOne({ semester: roomClash.semester, divisionNumber: parseInt(roomClash.division) || roomClash.division, department: roomClash.department });
          if (cls) clashClassName = cls.name;
        }

        const isEntryMatch = entryClassName && isEntryInSharedBatch(entry, roomDoc.sharedBatchName, entryClassName);
        const isClashMatch = clashClassName && isEntryInSharedBatch(roomClash, roomDoc.sharedBatchName, clashClassName);

        if (isEntryMatch && isClashMatch) {
          // Bypass conflict — both entries belong to the same combined batch group allowed for this room
        } else {
          clashes.push({
            type: 'room',
            message: `Room already occupied by ${roomClash.subject?.code || 'a class'} (${roomClash.department?.code || 'Dept'}, Div ${roomClash.division})`,
            conflict: {
              subject: roomClash.subject?.code,
              department: roomClash.department?.code,
              division: roomClash.division,
              faculty: roomClash.faculty?.name
            }
          });
        }
      } else {
        clashes.push({
          type: 'room',
          message: `Room already occupied by ${roomClash.subject?.code || 'a class'} (${roomClash.department?.code || 'Dept'}, Div ${roomClash.division})`,
          conflict: {
            subject: roomClash.subject?.code,
            department: roomClash.department?.code,
            division: roomClash.division,
            faculty: roomClash.faculty?.name
          }
        });
      }
    }
  }

  // 3. Division clash — same division+semester+department at same time (avoid double-booking a class)
  if (entry.department && entry.division && entry.semester) {
    const divQuery = {
      ...baseQuery,
      department: entry.department,
      division: entry.division,
      semester: entry.semester
    };
    // For practicals with batch, only clash with theory (no batch) or same batch
    if (entry.batch) {
      divQuery.$or = [{ batch: entry.batch }, { batch: '' }, { batch: null }];
    }
    const divClash = await TimetableEntry.findOne(divQuery)
      .populate('subject', 'name code');
    if (divClash) {
      clashes.push({
        type: 'division',
        message: `This class already has ${divClash.subject?.code || 'a subject'} at this time slot`,
        conflict: {
          subject: divClash.subject?.code,
          type: divClash.type,
          batch: divClash.batch
        }
      });
    }
  }

  return clashes;
}

// ─── CREATE TIMETABLE ENTRY ───────────────────────────────────
router.post('/', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const { day, timeSlot, subject, faculty, room, type, department, division, semester, academicYear, batch } = req.body;
    
    // Run clash detection
    const clashes = await detectEntryClashes({ day, timeSlot, subject, faculty, room, department, division, semester, academicYear, batch });
    if (clashes.length > 0) {
      return res.status(409).json({
        message: 'Scheduling conflicts detected!',
        clashes
      });
    }

    const entry = new TimetableEntry({
      day, timeSlot, subject, faculty, room, type: type || 'theory',
      department, division, semester: parseInt(semester),
      academicYear, batch: batch || '',
      status: 'draft',
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });
    await entry.save();

    // Populate for response
    const populated = await TimetableEntry.findById(entry._id)
      .populate('subject faculty department timeSlot')
      .populate({ path: 'room', populate: [{ path: 'department', select: 'name code' }, { path: 'sharedWith.deptId', select: 'name code' }] });

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'create', entry: populated });

    // Auto-sync workload for the assigned faculty
    if (faculty) syncFacultyWorkloadFromTimetable(faculty, io);

    res.status(201).json(populated);
  } catch (error) {
    console.error('POST /timetable error:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── UPDATE TIMETABLE ENTRY ───────────────────────────────────
router.put('/:id', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const existing = await TimetableEntry.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Entry not found.' });
    if (existing.isLocked) return res.status(403).json({ message: 'Entry is locked and cannot be edited.' });

    const { day, timeSlot, subject, faculty, room, type, department, division, semester, academicYear, batch } = req.body;
    const updateData = {
      day: day || existing.day,
      timeSlot: timeSlot || existing.timeSlot,
      subject, faculty, room,
      type: type || existing.type,
      department: department || existing.department,
      division: division || existing.division,
      semester: semester ? parseInt(semester) : existing.semester,
      academicYear: academicYear || existing.academicYear,
      batch: batch !== undefined ? batch : existing.batch
    };

    // Run clash detection (exclude self)
    const clashes = await detectEntryClashes(updateData, req.params.id);
    if (clashes.length > 0) {
      return res.status(409).json({
        message: 'Scheduling conflicts detected!',
        clashes
      });
    }

    updateData.lastModifiedBy = req.user._id;
    const previousFacultyId = existing.faculty?.toString();
    const updated = await TimetableEntry.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('subject faculty department timeSlot')
      .populate({ path: 'room', populate: [{ path: 'department', select: 'name code' }, { path: 'sharedWith.deptId', select: 'name code' }] });

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'update', entry: updated });

    // Auto-sync workload for both old and new faculty
    if (faculty) syncFacultyWorkloadFromTimetable(faculty, io);
    if (previousFacultyId && previousFacultyId !== faculty?.toString()) {
      syncFacultyWorkloadFromTimetable(previousFacultyId, io);
    }

    res.json(updated);
  } catch (error) {
    console.error('PUT /timetable error:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── DELETE TIMETABLE ENTRY ───────────────────────────────────
router.delete('/:id', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const entry = await TimetableEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found.' });
    if (entry.isLocked) return res.status(403).json({ message: 'Entry is locked.' });

    const deletedFacultyId = entry.faculty?.toString();
    await TimetableEntry.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'delete', entryId: req.params.id });

    // Auto-sync workload after deletion
    if (deletedFacultyId) syncFacultyWorkloadFromTimetable(deletedFacultyId, io);

    res.json({ message: 'Entry deleted.' });
  } catch (error) {
    console.error('DELETE /timetable error:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});


// ─── NEW: GET TIMETABLE SLOTS ─────────────────────────────────
router.get('/slots', auth, async (req, res) => {
  try {
    const { semesterId, department, classId, facultyId, roomId, day } = req.query;
    const filter = {};
    if (semesterId) filter.semesterId = semesterId;
    if (department) filter.department = department;
    if (classId) filter.classId = classId;
    if (facultyId) filter.facultyId = facultyId;
    if (roomId) filter.roomId = roomId;
    if (day) filter.day = day;

    const slots = await TimetableSlot.find(filter)
      .populate('classId department')
      .sort({ day: 1, slotNumber: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GET BY CLASS ─────────────────────────────────────────────
router.get('/class/:classId/:semId', auth, async (req, res) => {
  try {
    const slots = await TimetableSlot.find({
      classId: req.params.classId,
      semesterId: req.params.semId
    }).populate('classId department').sort({ day: 1, slotNumber: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GET BY FACULTY ───────────────────────────────────────────
router.get('/faculty/:facultyId/:semId', auth, async (req, res) => {
  try {
    const slots = await TimetableSlot.find({
      facultyId: req.params.facultyId,
      semesterId: req.params.semId
    }).populate('classId department').sort({ day: 1, slotNumber: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GET BY ROOM ──────────────────────────────────────────────
router.get('/room/:roomId/:semId', auth, async (req, res) => {
  try {
    const slots = await TimetableSlot.find({
      roomId: req.params.roomId,
      semesterId: req.params.semId
    }).populate('classId department').sort({ day: 1, slotNumber: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GET BY STUDENT ───────────────────────────────────────────
router.get('/student/:studentId/:semId', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const filter = {
      classId: student.classId,
      semesterId: req.params.semId,
      $or: [
        { batch: student.batch },
        { batch: null },
        { isClasswide: true }
      ]
    };

    const slots = await TimetableSlot.find(filter)
      .populate('classId department')
      .sort({ day: 1, slotNumber: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GET MASTER TIMETABLE ─────────────────────────────────────
router.get('/master/:deptId/:semId', auth, async (req, res) => {
  try {
    const slots = await TimetableSlot.find({
      department: req.params.deptId,
      semesterId: req.params.semId
    }).populate('classId department').sort({ day: 1, slotNumber: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── LEGACY MASTER (backward compat) ──────────────────────────
router.get('/master', auth, authorize('principal', 'dean', 'admin'), async (req, res) => {
  try {
    const { academicYear } = req.query;
    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    const entries = await TimetableEntry.find(filter)
      .populate('subject faculty room department timeSlot')
      .sort({ department: 1, division: 1, day: 1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── CHECK CLASHES ────────────────────────────────────────────
router.post('/check-clash', auth, async (req, res) => {
  try {
    const clashes = await detectClashes(req.body);
    res.json({ hasClash: clashes.length > 0, clashes });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── CREATE SLOT ──────────────────────────────────────────────
router.post('/slots', auth, requireAnyPermission(['timetable:editAll', 'timetable:editLabRoom']), async (req, res) => {
  try {
    const clashes = await detectClashes(req.body);
    if (clashes.length > 0) {
      return res.status(409).json({ message: 'Scheduling conflicts detected.', clashes });
    }

    const slot = new TimetableSlot({
      ...req.body,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });
    await slot.save();

    await AuditLog.create({
      action: 'CREATE', entity: 'TimetableSlot', entityId: slot._id,
      user: req.user._id, changes: req.body
    });

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'create', slot });

    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── UPDATE SLOT (full edit - admin) ──────────────────────────
router.put('/slots/:id', auth, requirePermission('timetable:editAll'), async (req, res) => {
  try {
    const existing = await TimetableSlot.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Slot not found.' });
    if (existing.isLocked) return res.status(403).json({ message: 'Slot is locked.' });

    const clashes = await detectClashes({ ...existing.toObject(), ...req.body }, req.params.id);
    if (clashes.length > 0) {
      return res.status(409).json({ message: 'Scheduling conflicts detected.', clashes });
    }

    const previousData = existing.toObject();
    const updated = await TimetableSlot.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModifiedBy: req.user._id },
      { new: true }
    );

    await AuditLog.create({
      action: 'UPDATE', entity: 'TimetableSlot', entityId: updated._id,
      user: req.user._id, changes: req.body, previousData
    });

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'update', slot: updated });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── PATCH ROOM ONLY (coordinator + admin) ────────────────────
router.patch('/slots/:id/room', auth, requireAnyPermission(['timetable:editAll', 'timetable:editLabRoom']), async (req, res) => {
  try {
    const existing = await TimetableSlot.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Slot not found.' });
    if (existing.isLocked) return res.status(403).json({ message: 'Slot is locked.' });

    const { roomId, roomName } = req.body;

    // Check room clash
    const roomClash = await TimetableSlot.findOne({
      _id: { $ne: req.params.id },
      day: existing.day,
      startTime: existing.startTime,
      semesterId: existing.semesterId,
      roomId
    });
    if (roomClash) {
      return res.status(409).json({ message: 'Room already occupied at this time.' });
    }

    const previousData = { roomId: existing.roomId, roomName: existing.roomName };
    existing.roomId = roomId;
    existing.roomName = roomName || existing.roomName;
    existing.lastModifiedBy = req.user._id;
    await existing.save();

    await AuditLog.create({
      action: 'UPDATE_ROOM', entity: 'TimetableSlot', entityId: existing._id,
      user: req.user._id, changes: { roomId, roomName }, previousData
    });

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'update', slot: existing });

    res.json(existing);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── DELETE SLOT ──────────────────────────────────────────────
router.delete('/slots/:id', auth, requirePermission('timetable:editAll'), async (req, res) => {
  try {
    const slot = await TimetableSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Slot not found.' });
    if (slot.isLocked) return res.status(403).json({ message: 'Slot is locked.' });

    await TimetableSlot.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      action: 'DELETE', entity: 'TimetableSlot', entityId: slot._id,
      user: req.user._id, previousData: slot.toObject()
    });

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'delete', slotId: req.params.id });

    res.json({ message: 'Slot deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GENERATE TIMETABLE ───────────────────────────────────────
router.post('/generate', auth, requirePermission('timetable:generate'), async (req, res) => {
  try {
    const { semesterId } = req.body;
    const io = req.app.get('io');
    const result = await generateTimetable(semesterId, req.user._id, io);
    res.json(result);
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ message: error.message || 'Generation failed.' });
  }
});

// ─── LEGACY AUTO GENERATE (with workload from DB, mini-project, DLOC, Mon-Fri) ─────
router.post('/auto-generate', auth, authorize('coordinator', 'hod'), async (req, res) => {
  try {
    const {
      department, division, academicYear,
      semesters: requestedSems, semesterType, yearGroup,
      miniProjectDays = 0, miniProjectHoursPerDay = 2,
      includeDLOC = true, useWorkloadFromDB = true
    } = req.body;

    console.log(`\n=== AUTO-GENERATE START ===`);
    console.log(`Department: ${department}, Division: ${division}, Semesters: [${requestedSems}]`);
    console.log(`SemType: ${semesterType}, YearGroup: ${yearGroup}, WorkloadDB: ${useWorkloadFromDB}`);

    // Monday to Friday ONLY
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const Department = require('../models/Department');
    const FacultyWorkload = require('../models/FacultyWorkload');
    const dept = await Department.findById(department);
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    const divisionsToGenerate = (!division || division === 'all') ? dept.divisions : [division];
    let semestersToGenerate = requestedSems || [];
    if (semestersToGenerate.length === 0) {
      semestersToGenerate = dept.semesters || [1,2,3,4,5,6,7,8];
    }

    // ★ FRESH FETCH: Always get the latest time slots from the DB
    const timeSlots = await TimeSlot.find({
      academicYear: academicYear || '2025-2026',
      department: department,
      isActive: true,
      isBreak: false
    }).sort({ slotNumber: 1 });

    // Also fetch ALL time slots (including breaks) for reference/logging
    const allTimeSlots = await TimeSlot.find({
      academicYear: academicYear || '2025-2026',
      department: department,
      isActive: true
    }).sort({ slotNumber: 1 });

    console.log(`[AutoGen] ★ Fetched ${timeSlots.length} teaching time slots (${allTimeSlots.length} total including breaks) from DB`);
    console.log(`[AutoGen] Teaching slots: ${timeSlots.map(s => s.startTime + '-' + s.endTime).join(', ')}`);
    
    // Pre-compute consecutive slot pairs for 2-hour practicals (log early for visibility)
    const earlyConsecutivePairs = [];
    for (let si = 0; si < timeSlots.length - 1; si++) {
      if (timeSlots[si].endTime === timeSlots[si + 1].startTime) {
        earlyConsecutivePairs.push(`${timeSlots[si].startTime}-${timeSlots[si + 1].endTime}`);
      }
    }
    console.log(`[AutoGen] Consecutive pairs for practicals: ${earlyConsecutivePairs.length} (${earlyConsecutivePairs.join(', ')})`);

    // Fetch rooms accessible by this department:
    // 1. Rooms owned by this dept, 2. Rooms shared with this dept, 3. General rooms (no dept assigned)
    const allRooms = await Room.find({ isActive: true }).populate('sharedWith.deptId', 'name code').sort({ capacity: -1 });
    const rooms = allRooms.filter(r => {
      const ownerId = r.department?.toString();
      if (!ownerId) return true; // General room — no dept owner
      if (ownerId === department) return true; // Owned by this dept
      if (r.isShared && r.sharedWith?.some(sw => {
        const swId = sw.deptId?._id?.toString() || sw.deptId?.toString();
        return swId === department;
      })) return true; // Shared with this dept
      return false;
    });
    console.log(`[AutoGen] Rooms accessible by dept: ${rooms.length}/${allRooms.length} (${rooms.map(r => r.code).join(', ')})`);

    if (timeSlots.length === 0) return res.status(400).json({ message: 'No time slots configured.' });
    if (rooms.length === 0) return res.status(400).json({ message: 'No rooms available.' });

    // === OCCUPANCY TRACKING ===
    const occupiedSlots = {};
    const isOccupied = (key) => !!occupiedSlots[key];
    const markOccupied = (keys) => keys.forEach(k => occupiedSlots[k] = true);

    // Load existing from OTHER departments
    const existingEntries = await TimetableEntry.find({
      academicYear: academicYear || '2025-2026',
      department: { $ne: department }
    });
    for (const entry of existingEntries) {
      const slotId = entry.timeSlot.toString();
      markOccupied([`r-${entry.room}-${entry.day}-${slotId}`]);
      if (entry.faculty) markOccupied([`f-${entry.faculty}-${entry.day}-${slotId}`]);
    }

    // Clear existing entries for selected config
    for (const sem of semestersToGenerate) {
      for (const div of divisionsToGenerate) {
        await TimetableEntry.deleteMany({
          department, academicYear: academicYear || '2025-2026',
          division: div, semester: sem
        });
      }
    }

    const userId = req.user._id;
    let totalGenerated = 0;
    let totalRequired = 0;
    const divisionResults = [];

    // --- FETCH WORKLOAD FROM DB ---
    let workloadMap = {}; // facultyId -> { theory, practical, miniProject, subjects }
    if (useWorkloadFromDB) {
      const activeSem = await SemesterConfig.findOne({ isActive: true });
      if (activeSem) {
        // Get workloads for this department specifically
        const deptWorkloads = await FacultyWorkload.find({
          semesterId: activeSem._id,
          department: department
        }).populate('facultyId allocations.subjectId');

        // Also get workloads without department field (old records) matching faculty in this dept
        const Faculty = require('../models/Faculty');
        const deptFacultyIds = (await Faculty.find({
          $or: [{ department: department }, { departments: department }]
        }).select('_id')).map(f => f._id.toString());

        const untaggedWorkloads = await FacultyWorkload.find({
          semesterId: activeSem._id,
          $or: [{ department: null }, { department: { $exists: false } }],
          facultyId: { $in: deptFacultyIds }
        }).populate('facultyId allocations.subjectId');

        const allWorkloads = [...deptWorkloads, ...untaggedWorkloads];

        // ★ ENFORCE: No workload = No timetable
        if (allWorkloads.length === 0) {
          return res.status(400).json({
            message: '❌ Cannot generate timetable — No faculty workload data found for this department.',
            details: 'Please add faculty workload assignments first via the "Faculty Workload" page before generating the timetable.',
            hint: 'Go to Faculty Workload → + Add Workload → assign subjects and hours to each faculty member.'
          });
        }

        console.log(`[AutoGen] Found ${allWorkloads.length} workload records for department`);
        for (const wl of allWorkloads) {
          const fId = wl.facultyId?._id?.toString();
          if (!fId) continue;
          workloadMap[fId] = {
            allocations: wl.allocations || [],
            miniProjectLoad: wl.miniProjectLoad || 0,
            majorProjectLoad: wl.majorProjectLoad || 0,
          };
        }
      } else {
        return res.status(400).json({
          message: '❌ No active semester configured.',
          details: 'Please configure an active semester before generating the timetable.'
        });
      }
    }

    for (const sem of semestersToGenerate) {
      // ★ FRESH FETCH: Get latest subjects from DB
      let subjects = await Subject.find({ department, semester: sem, isActive: true }).populate('faculty');
      console.log(`[AutoGen] ★ Sem ${sem}: Fetched ${subjects.length} active subjects from DB (${subjects.map(s => s.code).join(', ')})`);

      // Include DLOC subjects if flag set
      if (includeDLOC) {
        const dlocSubjects = await Subject.find({
          department, semester: sem, isActive: true,
          $or: [{ isDLOC: true }, { type: 'DLOC' }]
        }).populate('faculty');
        // Merge (avoid duplicates)
        const existingIds = new Set(subjects.map(s => s._id.toString()));
        for (const ds of dlocSubjects) {
          if (!existingIds.has(ds._id.toString())) subjects.push(ds);
        }
        if (dlocSubjects.length > 0) console.log(`[AutoGen] ★ Sem ${sem}: Added ${dlocSubjects.length} DLOC subjects`);
      }

      // --- ★ FRESH FETCH: BATCH COMBINE (SubjectAllocation) ENTRIES FOR THIS SEMESTER ---
      let batchCombineEntries = [];
      try {
        const Class = require('../models/Class');
        const classesForSem = await Class.find({ department, semester: sem, isActive: true });
        const classIds = classesForSem.map(c => c._id);
        console.log(`[AutoGen] ★ Sem ${sem}: Found ${classesForSem.length} active classes (${classesForSem.map(c => c.name).join(', ')})`);
        
        if (classIds.length > 0) {
          // Query without semesterId filter to catch all allocations for these classes
          batchCombineEntries = await SubjectAllocation.find({
            departmentId: department,
            classId: { $in: classIds }
          }).populate('classId theoryFacultyId combinedGroups.facultyId combinedGroups.labId batches.facultyId batches.labId');
        }
        
        // Also try direct query without class filter for safety
        if (batchCombineEntries.length === 0) {
          const allAllocations = await SubjectAllocation.find({
            departmentId: department
          }).populate('classId theoryFacultyId combinedGroups.facultyId combinedGroups.labId batches.facultyId batches.labId');
          
          // Filter by semester from the class
          batchCombineEntries = allAllocations.filter(a => {
            const classSem = a.classId?.semester;
            return classSem === sem;
          });
          console.log(`[AutoGen] ★ Sem ${sem}: Fallback query: ${allAllocations.length} total allocations, ${batchCombineEntries.length} for sem ${sem}`);
        }
        
        console.log(`[AutoGen] ★ Sem ${sem}: ${batchCombineEntries.length} batch combine entries → ${batchCombineEntries.map(e => e.subject?.code).join(', ')}`);
      } catch (err) {
        console.warn('Batch combine entries load error:', err.message);
      }

      if (subjects.length === 0 && batchCombineEntries.length === 0) continue;

      for (const div of divisionsToGenerate) {
        const requirements = [];

        // Collect per-batch practical queues for block scheduling
        // This is populated by BOTH regular subjects AND Batch Combine entries
        const batchPracticals = {}; // { 'B1': [{subject, faculty, lab, subjectName}], 'B2': [...] }

        // Look up the Class for this dept/sem/div to get batch labels
        const Class = require('../models/Class');
        const classForDiv = await Class.findOne({
          department, semester: sem,
          $or: [{ divisionNumber: div }, { divisionNumber: null }]
        });
        const batchLabelsForClass = classForDiv?.batchLabels || ['B1', 'B2', 'B3', 'B4'];
        console.log(`[AutoGen] Div ${div} Sem ${sem}: Class=${classForDiv?.name || 'N/A'}, Batches=[${batchLabelsForClass.join(',')}]`);

        // Collect subject codes from batch combine to avoid double-counting
        const batchCombineCodes = new Set(
          batchCombineEntries
            .filter(a => {
              const allocDiv = a.classId?.divisionNumber?.toString();
              return !allocDiv || allocDiv === div;
            })
            .map(a => a.subject?.code?.toUpperCase())
            .filter(Boolean)
        );

        // --- Build requirements from subjects + workload ---
        for (const subject of subjects) {
          // Skip if this subject is handled by Batch Combine
          if (batchCombineCodes.has(subject.code?.toUpperCase())) {
            console.log(`[AutoGen] Skipping "${subject.code}" — handled by Batch Combine`);
            continue;
          }

          const assignedFaculty = subject.faculty?.length > 0 ? subject.faculty[0]._id : null;

          // Check if we have workload data for this faculty+subject
          let theorySlots = 0;
          let practicalSlots = 0;
          let foundInWorkload = false;

          if (useWorkloadFromDB && assignedFaculty) {
            const fWorkload = workloadMap[assignedFaculty.toString()];
            if (fWorkload) {
              for (const alloc of fWorkload.allocations) {
                const allocSubjId = alloc.subjectId?._id?.toString() || alloc.subjectId?.toString();
                if (allocSubjId === subject._id.toString()) {
                  theorySlots = alloc.theoryLoad || 0;
                  const p = alloc.practicalLoad || {};
                  practicalSlots = Math.max(p.batch1 || 0, p.batch2 || 0, p.batch3 || 0, p.batch4 || 0);
                  foundInWorkload = true;
                  break;
                }
              }
            }
          }

          if (!foundInWorkload) {
            // Fallback: use subject's configured hours directly
            // Each division gets its own timetable, so don't divide by numDivs
            const thHrs = subject.theoryHours || 0;
            const prHrs = subject.practicalHours || 0;
            const totalHrs = subject.weeklyHours || 3;
            theorySlots = thHrs > 0 ? thHrs : (prHrs > 0 ? Math.max(0, totalHrs - prHrs) : totalHrs);
            practicalSlots = prHrs > 0 ? prHrs : 0;
            if (theorySlots === 0 && practicalSlots === 0) theorySlots = totalHrs;
          }

          console.log(`[AutoGen] Subject "${subject.code}": ${theorySlots} theory slots + ${practicalSlots} practical hrs → total ${theorySlots + practicalSlots} hrs/week`);

          // Add theory requirements
          for (let i = 0; i < Math.min(theorySlots, 6); i++) {
            requirements.push({
              subject: subject._id,
              faculty: assignedFaculty,
              type: 'theory',
              requiresLab: false,
              subjectName: subject.code
            });
          }

          // Add practical requirements → route into batchPracticals for rotation blocks
          if (practicalSlots > 0) {
            // Each batch gets this subject's practical session
            for (const bLabel of batchLabelsForClass) {
              if (!batchPracticals[bLabel]) batchPracticals[bLabel] = [];
              for (let i = 0; i < Math.min(practicalSlots, 4); i++) {
                batchPracticals[bLabel].push({
                  subject: subject._id,
                  faculty: assignedFaculty,
                  preferredLab: null,
                  subjectName: subject.code
                });
              }
            }
            console.log(`[AutoGen] Subject "${subject.code}": ${practicalSlots} practical slots → added to ALL ${batchLabelsForClass.length} batches for rotation`);
          }
        }

        // --- ADD REQUIREMENTS FROM BATCH COMBINE (SubjectAllocation) ---

        // Separate list for COMBINED PRACTICAL blocks (B1+B2 in same slot, B3+B4 in same slot)
        const combinedPracticalBlocks = []; // { subject, faculty, batches: ['B1','B2'], preferredLab, subjectName, hours }

        for (const alloc of batchCombineEntries) {
          const allocDiv = alloc.classId?.divisionNumber?.toString();
          if (allocDiv && allocDiv !== div) continue;

          const subCode = alloc.subject?.code || 'UNKNOWN';
          const subName = alloc.subject?.name || subCode;
          const facId = alloc.theoryFacultyId?._id?.toString() || null;
          const subType = alloc.subject?.type || 'theory';

          // Auto-create subject if needed
          let existingSubject = subjects.find(s => s.code === subCode) || subjects.find(s => s.code === subCode.toUpperCase());
          if (!existingSubject) {
            try {
              existingSubject = await Subject.findOne({ code: subCode.toUpperCase(), department, semester: sem });
              if (!existingSubject) {
                const totalHrs = (alloc.theoryHours || 0) + (alloc.batches?.reduce((sum, b) => sum + (b.hours || 0), 0) || 0);
                existingSubject = await Subject.create({
                  code: subCode.toUpperCase(), name: subName, type: subType,
                  department, semester: sem,
                  credits: Math.ceil(totalHrs / 2) || 2,
                  weeklyHours: totalHrs || 4,
                  theoryHours: alloc.theoryHours || 0,
                  practicalHours: alloc.batches?.reduce((sum, b) => sum + (b.hours || 0), 0) || 0,
                  faculty: facId ? [facId] : [], isActive: true
                });
              }
            } catch (err) {
              if (err.code === 11000) existingSubject = await Subject.findOne({ code: subCode.toUpperCase() });
              else console.warn(`[BatchCombine] Could not create ${subCode}:`, err.message);
            }
          }
          const subjectId = existingSubject?._id || null;
          if (!subjectId) continue;

          // Determine what types of combined groups exist
          const hasCombinedPracticalGroups = alloc.combinedGroups?.some(g => (g.type || 'theory') === 'practical');
          const hasCombinedTheoryGroups = alloc.combinedGroups?.some(g => (g.type || 'theory') === 'theory');

          // Add THEORY slots ONLY if:
          // - Subject has theoryHours > 0, AND
          // - Subject does NOT have combined practical groups (otherwise it's purely practical)
          // - OR subject explicitly has combined theory groups (handled below separately)
          if (alloc.theoryHours > 0 && !hasCombinedPracticalGroups && !hasCombinedTheoryGroups) {
            for (let i = 0; i < Math.min(alloc.theoryHours, 6); i++) {
              requirements.push({
                subject: subjectId, faculty: facId,
                type: 'theory', requiresLab: false, subjectName: subCode
              });
            }
            console.log(`[BatchCombine] ${subCode}: Added ${Math.min(alloc.theoryHours, 6)} theory slots`);
          }

          // Collect PRACTICALS per batch (for individual batch rotation — only if no combined groups)
          if (alloc.batches?.length > 0 && !hasCombinedPracticalGroups) {
            for (let bIdx = 0; bIdx < alloc.batches.length; bIdx++) {
              const batch = alloc.batches[bIdx];
              const batchName = batch.batchLabel || `B${bIdx + 1}`;
              const batchFac = batch.facultyId?._id?.toString() || facId;
              const batchLab = batch.labId?._id?.toString() || null;
              if (!batchPracticals[batchName]) batchPracticals[batchName] = [];
              for (let i = 0; i < (batch.hours || 2); i++) {
                batchPracticals[batchName].push({
                  subject: subjectId, faculty: batchFac,
                  preferredLab: batchLab, subjectName: subCode
                });
              }
            }
          }

          // Combined batch groups — handle theory and practical types separately
          if (alloc.isCombinedBatch && alloc.combinedGroups?.length > 0) {
            // Separate groups by type
            const theoryGroups = alloc.combinedGroups.filter(g => (g.type || subType || 'theory') === 'theory');
            const practicalGroups = alloc.combinedGroups.filter(g => (g.type || subType || 'theory') === 'practical');

            // THEORY combined groups: each group adds theory slots
            for (const group of theoryGroups) {
              const combFaculty = group.facultyId?._id?.toString() || facId;
              const combBatches = group.batches || [];
              const combTheoryHrs = alloc.theoryHours || existingSubject?.weeklyHours || 1;
              for (let i = 0; i < Math.min(combTheoryHrs, 6); i++) {
                requirements.push({
                  subject: subjectId, faculty: combFaculty,
                  type: 'theory', requiresLab: false, subjectName: subCode,
                  isCombined: true, combinedWith: combBatches.join('+')
                });
              }
              console.log(`[BatchCombine] Theory combined: ${subCode} → ${combBatches.join('+')} (${Math.min(combTheoryHrs, 6)} hrs)`);
            }

            // PRACTICAL combined groups: ALL groups from the same subject go into ONE simultaneous block
            // e.g., CCL has B1+B2 and B3+B4 → both placed in the SAME time slot with DIFFERENT labs
            if (practicalGroups.length > 0) {
              // Find which batches are already covered by combined groups
              const coveredBatches = new Set();
              for (const g of practicalGroups) {
                for (const b of (g.batches || [])) coveredBatches.add(b);
              }

              // Auto-fill remaining batches from the class that are NOT covered
              // e.g., if only B1+B2 is defined, auto-create a group for B3+B4
              const uncoveredBatches = batchLabelsForClass.filter(b => !coveredBatches.has(b));
              const allPracticalGroups = [...practicalGroups];

              if (uncoveredBatches.length > 0) {
                // Group uncovered batches into pairs matching the size of existing groups
                const groupSize = practicalGroups[0]?.batches?.length || 2;
                for (let i = 0; i < uncoveredBatches.length; i += groupSize) {
                  const autoBatches = uncoveredBatches.slice(i, i + groupSize);
                  if (autoBatches.length > 0) {
                    allPracticalGroups.push({
                      batches: autoBatches,
                      type: 'practical',
                      facultyId: practicalGroups[0]?.facultyId || null, // use same faculty or null
                      labId: null // auto-assign lab
                    });
                    console.log(`[BatchCombine] Auto-created group for uncovered batches: [${autoBatches.join(', ')}]`);
                  }
                }
              }

              // Determine sessions per week using the SUBJECT's actual hours
              const subjectPractHours = existingSubject?.practicalHours || existingSubject?.weeklyHours || 2;
              const sessionsPerGroup = Math.min(2, Math.max(1, Math.floor(subjectPractHours / 2)));
              
              for (let s = 0; s < sessionsPerGroup; s++) {
                // Each session = one simultaneous block with ALL practical groups (defined + auto-created)
                const simultaneousBlock = allPracticalGroups.map(group => ({
                  subject: subjectId,
                  faculty: group.facultyId?._id?.toString() || group.facultyId?.toString() || facId,
                  batches: group.batches || [],
                  preferredLab: group.labId?._id?.toString() || group.labId?.toString() || null,
                  subjectName: subCode,
                  batchLabel: (group.batches || []).join('+')
                }));
                combinedPracticalBlocks.push(simultaneousBlock);
              }
              const groupLabels = allPracticalGroups.map(g => (g.batches || []).join('+')).join(' & ');
              console.log(`[BatchCombine] Practical combined: ${subCode} → [${groupLabels}] (${sessionsPerGroup} sessions × 2hr, subjectPractHrs=${subjectPractHours})`);
            }
          }
        }

        console.log(`[BatchCombine] Combined practical simultaneous blocks to place: ${combinedPracticalBlocks.length}`);

        // --- BUILD PRACTICAL BLOCKS ---
        // Each block = one 2-hour time slot where ALL batches are busy simultaneously
        // IMPORTANT: Rotate subjects so each batch gets a DIFFERENT subject in the same slot
        //
        // Each practical entry in batchPracticals has been added per-hour.
        // A subject with hours=2 means 2 entries → 1 session (1 × 2-hour block).
        // A subject with hours=4 means 4 entries → 2 sessions (2 × 2-hour blocks).
        //
        // Step 1: Group each batch's entries by subject → count total hours per subject
        // Step 2: Convert hours into sessions (1 session = 2 consecutive hours)
        // Step 3: Apply Latin-square rotation so each batch gets a different subject per session
        // Step 4: Build blocks where each block = [B1:SubX, B2:SubY, B3:SubZ, B4:SubW] for ONE 2-hour slot

        const practicalBlocks = [];
        const batchNames = Object.keys(batchPracticals).sort();
        if (batchNames.length > 0) {
          // Step 1 & 2: For each batch, build an ordered list of SESSIONS
          // Each session = { subject, faculty, preferredLab, subjectName }
          // 2 hours → 1 session, 4 hours → 2 sessions, etc.
          const batchSessions = {};
          for (const bName of batchNames) {
            const queue = batchPracticals[bName];
            // Group by subject
            const subjectMap = {};
            for (const item of queue) {
              const key = item.subjectName;
              if (!subjectMap[key]) subjectMap[key] = { ...item, hourCount: 0 };
              subjectMap[key].hourCount++;
            }
            // Convert to sessions (each session = 2 hours = 1 consecutive block)
            const sessions = [];
            for (const key of Object.keys(subjectMap)) {
              const info = subjectMap[key];
              const numSessions = Math.max(1, Math.floor(info.hourCount / 2)); // 2hrs→1, 4hrs→2
              for (let s = 0; s < numSessions; s++) {
                sessions.push({
                  subject: info.subject,
                  faculty: info.faculty,
                  preferredLab: info.preferredLab,
                  subjectName: info.subjectName,
                  isCombined: info.isCombined,
                  combinedWith: info.combinedWith
                });
              }
            }
            batchSessions[bName] = sessions;
          }

          // Step 3: Apply Latin-square rotation at SESSION level
          // B1 sessions: [SubA, SubB, SubC, SubD] (original order)
          // B2 sessions: [SubB, SubC, SubD, SubA] (rotated by 1)
          // B3 sessions: [SubC, SubD, SubA, SubB] (rotated by 2)
          // B4 sessions: [SubD, SubA, SubB, SubC] (rotated by 3)
          const rotatedSessions = {};
          for (let bIdx = 0; bIdx < batchNames.length; bIdx++) {
            const bName = batchNames[bIdx];
            const sessions = batchSessions[bName];
            if (sessions.length === 0) { rotatedSessions[bName] = []; continue; }
            const offset = bIdx % sessions.length;
            rotatedSessions[bName] = [...sessions.slice(offset), ...sessions.slice(0, offset)];
          }

          // Step 4: Pair corresponding session indices across all batches into blocks
          const maxSessions = Math.max(...batchNames.map(b => rotatedSessions[b].length));
          for (let sIdx = 0; sIdx < maxSessions; sIdx++) {
            const block = [];
            for (const batchName of batchNames) {
              const sessions = rotatedSessions[batchName];
              if (sIdx < sessions.length) {
                block.push({ ...sessions[sIdx], batchName });
              }
            }
            if (block.length > 0) {
              const subjectList = block.map(b => `${b.batchName}:${b.subjectName}`).join(', ');
              console.log(`[BatchCombine] Block ${practicalBlocks.length}: ${subjectList}`);
              practicalBlocks.push(block);
            }
          }

          console.log(`[BatchCombine] Div ${div} Sem ${sem}: Created ${practicalBlocks.length} practical session-blocks for ${batchNames.length} batches (${batchNames.join(', ')})`);
          console.log(`[BatchCombine] Each block = 1 × 2-hour consecutive slot for ALL batches simultaneously`);
        }

        // --- Add mini project slots ---
        if (parseInt(miniProjectDays) > 0 && parseInt(miniProjectHoursPerDay) > 0) {
          for (let d = 0; d < parseInt(miniProjectDays); d++) {
            for (let h = 0; h < parseInt(miniProjectHoursPerDay); h++) {
              requirements.push({
                subject: null, faculty: null,
                type: 'project', requiresLab: false,
                subjectName: 'MINI-PROJECT', isMiniProject: true
              });
            }
          }
        }

        // Shuffle theory/project requirements for randomized distribution
        for (let i = requirements.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [requirements[i], requirements[j]] = [requirements[j], requirements[i]];
        }
        // Shuffle practical blocks too
        for (let i = practicalBlocks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [practicalBlocks[i], practicalBlocks[j]] = [practicalBlocks[j], practicalBlocks[i]];
        }
        // Shuffle combined practical blocks
        for (let i = combinedPracticalBlocks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combinedPracticalBlocks[i], combinedPracticalBlocks[j]] = [combinedPracticalBlocks[j], combinedPracticalBlocks[i]];
        }

        totalRequired += requirements.length + practicalBlocks.length + combinedPracticalBlocks.length;
        let placed = 0;

        // === PHASE 0: Schedule COMBINED PRACTICAL BLOCKS ===
        // Each combBlock is an ARRAY of groups that go SIMULTANEOUSLY
        // e.g., combBlock = [{B1+B2, faculty, lab}, {B3+B4, faculty, lab}]
        // ALL groups are placed in the SAME 2-hour consecutive slots with DIFFERENT labs
        if (combinedPracticalBlocks.length > 0) {
          const combConsecutivePairs = [];
          for (let si = 0; si < timeSlots.length - 1; si++) {
            const s1 = timeSlots[si];
            const s2 = timeSlots[si + 1];
            if (s1.endTime === s2.startTime) combConsecutivePairs.push([s1, s2]);
          }

          for (const simultaneousBlock of combinedPracticalBlocks) {
            let blockPlaced = false;

            const combRandomDayOffset = Math.floor(Math.random() * days.length);
            for (let d = 0; d < days.length; d++) {
              if (blockPlaced) break;
              const day = days[(d + combRandomDayOffset) % days.length];

              const combRandomPairOffset = Math.floor(Math.random() * combConsecutivePairs.length);
              for (let c = 0; c < combConsecutivePairs.length; c++) {
                if (blockPlaced) break;
                const [slot1, slot2] = combConsecutivePairs[(c + combRandomPairOffset) % combConsecutivePairs.length];

                const divKey1 = `d-${div}-${department}-${sem}-${day}-${slot1._id}`;
                const divKey2 = `d-${div}-${department}-${sem}-${day}-${slot2._id}`;
                if (isOccupied(divKey1) || isOccupied(divKey2)) continue;

                // Check ALL faculty in ALL groups are free for BOTH slots
                let allFacultyFree = true;
                for (const group of simultaneousBlock) {
                  if (group.faculty) {
                    if (isOccupied(`f-${group.faculty}-${day}-${slot1._id}`) || isOccupied(`f-${group.faculty}-${day}-${slot2._id}`)) {
                      allFacultyFree = false; break;
                    }
                  }
                }
                if (!allFacultyFree) continue;

                // Find a SEPARATE lab for EACH group (both slots)
                const labAssignments = [];
                const usedLabs = new Set();
                let allLabsFound = true;
                for (const group of simultaneousBlock) {
                  let lab = null;
                  if (group.preferredLab && !usedLabs.has(group.preferredLab)) {
                    const lk1 = `r-${group.preferredLab}-${day}-${slot1._id}`;
                    const lk2 = `r-${group.preferredLab}-${day}-${slot2._id}`;
                    if (!isOccupied(lk1) && !isOccupied(lk2)) lab = group.preferredLab;
                  }
                  if (!lab) {
                    for (const room of rooms) {
                      if (room.type !== 'lab') continue;
                      const rid = room._id.toString();
                      if (usedLabs.has(rid)) continue;
                      const lk1 = `r-${rid}-${day}-${slot1._id}`;
                      const lk2 = `r-${rid}-${day}-${slot2._id}`;
                      if (!isOccupied(lk1) && !isOccupied(lk2)) { lab = rid; break; }
                    }
                  }
                  if (!lab) { allLabsFound = false; break; }
                  usedLabs.add(lab);
                  labAssignments.push(lab);
                }
                if (!allLabsFound) continue;

                // Place ALL groups in BOTH consecutive slots
                const keys = [divKey1, divKey2];
                for (let i = 0; i < simultaneousBlock.length; i++) {
                  const g = simultaneousBlock[i];
                  if (g.faculty) {
                    keys.push(`f-${g.faculty}-${day}-${slot1._id}`, `f-${g.faculty}-${day}-${slot2._id}`);
                  }
                  keys.push(`r-${labAssignments[i]}-${day}-${slot1._id}`, `r-${labAssignments[i]}-${day}-${slot2._id}`);
                }
                markOccupied(keys);

                for (let i = 0; i < simultaneousBlock.length; i++) {
                  const g = simultaneousBlock[i];
                  for (const slot of [slot1, slot2]) {
                    const entryData = {
                      day, timeSlot: slot._id, room: labAssignments[i], department,
                      division: div, semester: sem, academicYear: academicYear || '2025-2026',
                      type: 'practical', batch: g.batchLabel, status: 'draft',
                      createdBy: userId, lastModifiedBy: userId
                    };
                    if (g.subject) entryData.subject = g.subject;
                    if (g.faculty) entryData.faculty = g.faculty;
                    await new TimetableEntry(entryData).save();
                    totalGenerated++;
                  }
                }
                placed++;
                blockPlaced = true;
                const gl = simultaneousBlock.map(g => g.batchLabel).join(' & ');
                console.log(`[AutoGen] Combined practical: ${simultaneousBlock[0]?.subjectName} [${gl}] → ${day} slots ${slot1.slotNumber}-${slot2.slotNumber}`);
              }
            }

            // Fallback: single slot
            if (!blockPlaced) {
              const fbCombRandomDayOffset = Math.floor(Math.random() * days.length);
              for (let d = 0; d < days.length; d++) {
                if (blockPlaced) break;
                const day = days[(d + fbCombRandomDayOffset) % days.length];

                const fbCombRandomSlotOffset = Math.floor(Math.random() * timeSlots.length);
                for (let s = 0; s < timeSlots.length; s++) {
                  if (blockPlaced) break;
                  const slot = timeSlots[(s + fbCombRandomSlotOffset) % timeSlots.length];
                  const divKey = `d-${div}-${department}-${sem}-${day}-${slot._id}`;
                  if (isOccupied(divKey)) continue;
                  let allFree = true;
                  for (const g of simultaneousBlock) {
                    if (g.faculty && isOccupied(`f-${g.faculty}-${day}-${slot._id}`)) { allFree = false; break; }
                  }
                  if (!allFree) continue;
                  const labAssignments = []; const usedLabs = new Set(); let allOk = true;
                  for (const g of simultaneousBlock) {
                    let lab = null;
                    if (g.preferredLab && !usedLabs.has(g.preferredLab) && !isOccupied(`r-${g.preferredLab}-${day}-${slot._id}`)) lab = g.preferredLab;
                    if (!lab) {
                      for (const room of rooms) {
                        if (room.type !== 'lab') continue;
                        const rid = room._id.toString();
                        if (!usedLabs.has(rid) && !isOccupied(`r-${rid}-${day}-${slot._id}`)) { lab = rid; break; }
                      }
                    }
                    if (!lab) { allOk = false; break; }
                    usedLabs.add(lab); labAssignments.push(lab);
                  }
                  if (!allOk) continue;
                  const keys = [divKey];
                  for (let i = 0; i < simultaneousBlock.length; i++) {
                    if (simultaneousBlock[i].faculty) keys.push(`f-${simultaneousBlock[i].faculty}-${day}-${slot._id}`);
                    keys.push(`r-${labAssignments[i]}-${day}-${slot._id}`);
                  }
                  markOccupied(keys);
                  for (let i = 0; i < simultaneousBlock.length; i++) {
                    const g = simultaneousBlock[i];
                    const ed = { day, timeSlot: slot._id, room: labAssignments[i], department, division: div, semester: sem, academicYear: academicYear || '2025-2026', type: 'practical', batch: g.batchLabel, status: 'draft', createdBy: userId, lastModifiedBy: userId };
                    if (g.subject) ed.subject = g.subject; if (g.faculty) ed.faculty = g.faculty;
                    await new TimetableEntry(ed).save(); totalGenerated++;
                  }
                  placed++; blockPlaced = true;
                  console.log(`[AutoGen] Combined practical (fallback): ${simultaneousBlock[0]?.subjectName} [${simultaneousBlock.map(g=>g.batchLabel).join('&')}] → ${day} slot ${slot.slotNumber}`);
                }
              }
            }
            if (!blockPlaced) console.warn(`[AutoGen] UNPLACED combined: ${simultaneousBlock[0]?.subjectName} [${simultaneousBlock.map(g=>g.batchLabel).join('&')}]`);
          }
          console.log(`[AutoGen] Combined practical blocks placed: ${combinedPracticalBlocks.length}`);
        }

        // === PHASE 1: Schedule ROTATION PRACTICAL BLOCKS in CONSECUTIVE 2-hour slots ===
        // Pre-compute consecutive slot pairs (2 adjacent non-break slots)
        const consecutivePairs = [];
        for (let si = 0; si < timeSlots.length - 1; si++) {
          const s1 = timeSlots[si];
          const s2 = timeSlots[si + 1];
          // CRITICAL: Only pair slots that are truly consecutive (no break/gap between)
          if (s1.endTime === s2.startTime) {
            consecutivePairs.push([s1, s2]);
          }
        }
        console.log(`[AutoGen] Found ${consecutivePairs.length} consecutive slot pairs for 2-hour practicals`);
        if (consecutivePairs.length === 0) {
          console.warn(`[AutoGen] WARNING: No consecutive time slot pairs found! Practicals cannot be 2-hour blocks.`);
          console.warn(`[AutoGen] Time slots: ${timeSlots.map(s => s.startTime + '-' + s.endTime).join(', ')}`);
        }

        for (const block of practicalBlocks) {
          let blockPlaced = false;
          
          // Try to place in consecutive 2-hour slots
          const randomDayOffsetBlock = Math.floor(Math.random() * days.length);
          for (let d = 0; d < days.length; d++) {
            if (blockPlaced) break;
            const day = days[(d + randomDayOffsetBlock) % days.length];

            const randomPairOffset = Math.floor(Math.random() * consecutivePairs.length);
            for (let c = 0; c < consecutivePairs.length; c++) {
              if (blockPlaced) break;
              const [slot1, slot2] = consecutivePairs[(c + randomPairOffset) % consecutivePairs.length];
              
              const divKey1 = `d-${div}-${department}-${sem}-${day}-${slot1._id}`;
              const divKey2 = `d-${div}-${department}-${sem}-${day}-${slot2._id}`;
              if (isOccupied(divKey1) || isOccupied(divKey2)) continue;

              // Check ALL faculty in the block are free for BOTH slots
              let allFacultyFree = true;
              for (const entry of block) {
                if (entry.faculty) {
                  const fKey1 = `f-${entry.faculty}-${day}-${slot1._id}`;
                  const fKey2 = `f-${entry.faculty}-${day}-${slot2._id}`;
                  if (isOccupied(fKey1) || isOccupied(fKey2)) { allFacultyFree = false; break; }
                }
              }
              if (!allFacultyFree) continue;

              // Find labs for each batch entry (must be free for BOTH slots)
              const labAssignments = [];
              const usedLabsInBlock = new Set();
              let allLabsFound = true;
              for (const entry of block) {
                let selectedLab = null;
                // Try preferred lab first
                if (entry.preferredLab) {
                  const labKey1 = `r-${entry.preferredLab}-${day}-${slot1._id}`;
                  const labKey2 = `r-${entry.preferredLab}-${day}-${slot2._id}`;
                  if (!isOccupied(labKey1) && !isOccupied(labKey2) && !usedLabsInBlock.has(entry.preferredLab)) {
                    selectedLab = entry.preferredLab;
                  }
                }
                // Fallback: find any available lab for both slots
                if (!selectedLab) {
                  for (const room of rooms) {
                    if (room.type !== 'lab') continue;
                    const labKey1 = `r-${room._id}-${day}-${slot1._id}`;
                    const labKey2 = `r-${room._id}-${day}-${slot2._id}`;
                    if (!isOccupied(labKey1) && !isOccupied(labKey2) && !usedLabsInBlock.has(room._id.toString())) {
                      selectedLab = room._id.toString();
                      break;
                    }
                  }
                }
                if (!selectedLab) { allLabsFound = false; break; }
                usedLabsInBlock.add(selectedLab);
                labAssignments.push(selectedLab);
              }
              if (!allLabsFound) continue;

              // All checks passed — place the entire block in BOTH consecutive slots
              const keys = [divKey1, divKey2];
              for (let i = 0; i < block.length; i++) {
                const entry = block[i];
                if (entry.faculty) {
                  keys.push(`f-${entry.faculty}-${day}-${slot1._id}`);
                  keys.push(`f-${entry.faculty}-${day}-${slot2._id}`);
                }
                keys.push(`r-${labAssignments[i]}-${day}-${slot1._id}`);
                keys.push(`r-${labAssignments[i]}-${day}-${slot2._id}`);
              }
              markOccupied(keys);

              // Create TWO TimetableEntries per batch (one for each consecutive hour)
              for (let i = 0; i < block.length; i++) {
                const entry = block[i];
                const batchLabel = entry.isCombined ? entry.combinedWith : entry.batchName;
                
                for (const slot of [slot1, slot2]) {
                  const entryData = {
                    day, timeSlot: slot._id,
                    room: labAssignments[i], department,
                    division: div, semester: sem,
                    academicYear: academicYear || '2025-2026',
                    type: 'practical',
                    batch: batchLabel,
                    status: 'draft',
                    createdBy: userId, lastModifiedBy: userId
                  };
                  if (entry.subject) entryData.subject = entry.subject;
                  if (entry.faculty) entryData.faculty = entry.faculty;
                  const te = new TimetableEntry(entryData);
                  await te.save();
                  totalGenerated++;
                }
              }
              placed++;
              blockPlaced = true;
              console.log(`[AutoGen] Practical block placed: ${day} slots ${slot1.slotNumber}-${slot2.slotNumber} (consecutive 2hr)`);
            }
          }

          // Fallback: if consecutive pair not found, try single slot
          if (!blockPlaced) {
            const randomDayOffsetFb = Math.floor(Math.random() * days.length);
            for (let d = 0; d < days.length; d++) {
              if (blockPlaced) break;
              const day = days[(d + randomDayOffsetFb) % days.length];

              const randomSlotOffsetFb = Math.floor(Math.random() * timeSlots.length);
              for (let s = 0; s < timeSlots.length; s++) {
                if (blockPlaced) break;
                const slot = timeSlots[(s + randomSlotOffsetFb) % timeSlots.length];
                const divKey = `d-${div}-${department}-${sem}-${day}-${slot._id}`;
                if (isOccupied(divKey)) continue;

                let allFacultyFree = true;
                for (const entry of block) {
                  if (entry.faculty) {
                    const fKey = `f-${entry.faculty}-${day}-${slot._id}`;
                    if (isOccupied(fKey)) { allFacultyFree = false; break; }
                  }
                }
                if (!allFacultyFree) continue;

                const labAssignments = [];
                const usedLabsInBlock = new Set();
                let allLabsFound = true;
                for (const entry of block) {
                  let selectedLab = null;
                  if (entry.preferredLab) {
                    const labKey = `r-${entry.preferredLab}-${day}-${slot._id}`;
                    if (!isOccupied(labKey) && !usedLabsInBlock.has(entry.preferredLab)) {
                      selectedLab = entry.preferredLab;
                    }
                  }
                  if (!selectedLab) {
                    for (const room of rooms) {
                      if (room.type !== 'lab') continue;
                      const labKey = `r-${room._id}-${day}-${slot._id}`;
                      if (!isOccupied(labKey) && !usedLabsInBlock.has(room._id.toString())) {
                        selectedLab = room._id.toString();
                        break;
                      }
                    }
                  }
                  if (!selectedLab) { allLabsFound = false; break; }
                  usedLabsInBlock.add(selectedLab);
                  labAssignments.push(selectedLab);
                }
                if (!allLabsFound) continue;

                const keys = [divKey];
                for (let i = 0; i < block.length; i++) {
                  const entry = block[i];
                  if (entry.faculty) keys.push(`f-${entry.faculty}-${day}-${slot._id}`);
                  keys.push(`r-${labAssignments[i]}-${day}-${slot._id}`);
                }
                markOccupied(keys);

                for (let i = 0; i < block.length; i++) {
                  const entry = block[i];
                  const batchLabel = entry.isCombined ? entry.combinedWith : entry.batchName;
                  const entryData = {
                    day, timeSlot: slot._id, room: labAssignments[i], department,
                    division: div, semester: sem, academicYear: academicYear || '2025-2026',
                    type: 'practical', batch: batchLabel, status: 'draft',
                    createdBy: userId, lastModifiedBy: userId
                  };
                  if (entry.subject) entryData.subject = entry.subject;
                  if (entry.faculty) entryData.faculty = entry.faculty;
                  const te = new TimetableEntry(entryData);
                  await te.save();
                  totalGenerated++;
                }
                placed++;
                blockPlaced = true;
                console.log(`[AutoGen] Practical block placed: ${day} slot ${slot.slotNumber} (single fallback)`);
              }
            }
          }
        }

        // === PHASE 2: Schedule theory, project, and other requirements ===
        
        // Shuffle requirements to avoid deterministic failure always burying the same subjects
        for (let i = requirements.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [requirements[i], requirements[j]] = [requirements[j], requirements[i]];
        }

        for (const requirement of requirements) {
          let done = false;

          // Start searching from a random day/slot to distribute lectures evenly
          const randomDayOffset = Math.floor(Math.random() * days.length);
          for (let d = 0; d < days.length; d++) {
            if (done) break;
            const day = days[(d + randomDayOffset) % days.length];

            // Prioritize standard teaching slots, optionally shift start indices
            const randomSlotOffset = Math.floor(Math.random() * timeSlots.length);
            for (let s = 0; s < timeSlots.length; s++) {
              if (done) break;
              const slot = timeSlots[(s + randomSlotOffset) % timeSlots.length];
              if (done) break;
              const divKey = `d-${div}-${department}-${sem}-${day}-${slot._id}`;
              if (isOccupied(divKey)) continue;

              if (requirement.faculty) {
                const facultyKey = `f-${requirement.faculty}-${day}-${slot._id}`;
                if (isOccupied(facultyKey)) continue;
              }

              // Mini project: no room needed
              if (requirement.isMiniProject) {
                const keys = [divKey];
                if (requirement.faculty) keys.push(`f-${requirement.faculty}-${day}-${slot._id}`);
                markOccupied(keys);
                const entryData = {
                  day, timeSlot: slot._id, department,
                  division: div, semester: sem,
                  academicYear: academicYear || '2025-2026',
                  type: 'project', status: 'draft',
                  createdBy: userId, lastModifiedBy: userId
                };
                if (requirement.subject) entryData.subject = requirement.subject;
                if (requirement.faculty) entryData.faculty = requirement.faculty;
                const entry = new TimetableEntry(entryData);
                await entry.save();
                placed++; totalGenerated++;
                done = true; continue;
              }

              // Room selection for theory
              const roomType = requirement.requiresLab ? 'lab' : 'classroom';
              let selectedRoom = null;
              for (const room of rooms) {
                const roomKey = `r-${room._id}-${day}-${slot._id}`;
                if (!isOccupied(roomKey) && (room.type === roomType || room.type === 'classroom')) {
                  selectedRoom = room; break;
                }
              }
              if (!selectedRoom) continue;

              const roomKey = `r-${selectedRoom._id}-${day}-${slot._id}`;
              const keys = [divKey, roomKey];
              if (requirement.faculty) keys.push(`f-${requirement.faculty}-${day}-${slot._id}`);
              markOccupied(keys);

              const entryData = {
                day, timeSlot: slot._id,
                room: selectedRoom._id, department,
                division: div, semester: sem,
                academicYear: academicYear || '2025-2026',
                type: requirement.type, status: 'draft',
                createdBy: userId, lastModifiedBy: userId
              };
              if (requirement.subject) entryData.subject = requirement.subject;
              if (requirement.faculty) entryData.faculty = requirement.faculty;
              if (requirement.batchName) entryData.batch = requirement.batchName;

              const entry = new TimetableEntry(entryData);
              await entry.save();
              placed++; totalGenerated++;
              done = true;
            }
          }
        }

        const totalRequiredForDiv = requirements.length + practicalBlocks.length + combinedPracticalBlocks.length;
        divisionResults.push({
          division: div, semester: sem,
          required: totalRequiredForDiv, placed,
          unplaced: totalRequiredForDiv - placed
        });
      }
    }

    // Build clash report by checking all existing entries for conflicts
    const clashReport = [];
    const allNewEntries = await TimetableEntry.find({
      department, academicYear: academicYear || '2025-2026'
    }).populate('faculty', 'name').populate('room', 'code name').populate('subject', 'code name');
    
    // Check faculty clashes across departments
    for (const entry of allNewEntries) {
      if (!entry.faculty) continue;
      const facClash = await TimetableEntry.findOne({
        day: entry.day, timeSlot: entry.timeSlot,
        academicYear: entry.academicYear,
        faculty: entry.faculty._id,
        department: { $ne: department },
        _id: { $ne: entry._id }
      }).populate('department', 'code name').populate('subject', 'code');
      if (facClash) {
        clashReport.push({
          type: 'faculty',
          faculty: entry.faculty?.name,
          day: entry.day,
          subject: entry.subject?.code,
          conflictDept: facClash.department?.code,
          conflictSubject: facClash.subject?.code,
          message: `${entry.faculty?.name} is double-booked on ${entry.day} — your ${entry.subject?.code} vs ${facClash.department?.code}'s ${facClash.subject?.code}`
        });
      }
    }

    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'auto-generate', department });
    res.json({
      message: `Generated: ${totalGenerated}/${totalRequired}${clashReport.length > 0 ? ` (⚠️ ${clashReport.length} conflicts detected)` : ''}`,
      totalRequired, placed: totalGenerated,
      unplaced: totalRequired - totalGenerated,
      divisions: divisionResults,
      semesterType, yearGroup,
      clashReport
    });
  } catch (error) {
    console.error('Auto-generate error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── LEGACY CRUD (backward compat) ───────────────────────────
router.post('/', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const entry = new TimetableEntry({ ...req.body, createdBy: req.user._id, lastModifiedBy: req.user._id });
    await entry.save();
    const populated = await TimetableEntry.findById(entry._id).populate('subject faculty room department timeSlot');
    await AuditLog.create({ action: 'CREATE', entity: 'TimetableEntry', entityId: entry._id, user: req.user._id, changes: req.body });
    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'create', entry: populated });
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/:id', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const existing = await TimetableEntry.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Entry not found.' });
    if (existing.isLocked) return res.status(403).json({ message: 'Timetable is locked.' });
    const updated = await TimetableEntry.findByIdAndUpdate(req.params.id, { ...req.body, lastModifiedBy: req.user._id }, { new: true }).populate('subject faculty room department timeSlot');
    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'update', entry: updated });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.delete('/:id', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const entry = await TimetableEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found.' });
    if (entry.isLocked) return res.status(403).json({ message: 'Timetable is locked.' });
    await TimetableEntry.findByIdAndDelete(req.params.id);
    const io = req.app.get('io');
    io.emit('timetable-updated', { action: 'delete', entryId: req.params.id });
    res.json({ message: 'Entry deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── APPROVAL WORKFLOW ────────────────────────────────────────
router.post('/submit-approval', auth, authorize('coordinator', 'hod'), async (req, res) => {
  try {
    const { department, academicYear, semester, level } = req.body;
    
    // Validate required fields
    if (!department) return res.status(400).json({ message: 'Department is required.' });
    if (!academicYear) return res.status(400).json({ message: 'Academic year is required.' });
    if (!semester && semester !== 0) return res.status(400).json({ message: 'Semester is required.' });
    
    const approval = new Approval({ 
      department, 
      academicYear, 
      semester: parseInt(semester), 
      submittedBy: req.user._id, 
      level: level || 'hod' 
    });
    await approval.save();
    await TimetableEntry.updateMany({ department, academicYear, semester: parseInt(semester) }, { status: 'submitted' });
    // Also update new slots
    const activeSem = await SemesterConfig.findOne({ isActive: true });
    if (activeSem) {
      await TimetableSlot.updateMany({ department, semesterId: activeSem._id }, { status: 'submitted' });
    }
    const io = req.app.get('io');
    io.to('role-principal').emit('approval-request', approval);
    io.to('role-hod').emit('approval-request', approval);
    res.json(approval);
  } catch (error) {
    console.error('submit-approval error:', error.message, req.body);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.get('/approvals', auth, authorize('principal', 'hod', 'dean', 'coordinator'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const approvals = await Approval.find(filter).populate('department submittedBy reviewedBy').sort({ createdAt: -1 });
    res.json(approvals);
  } catch (error) {
    console.error('GET /timetable/approvals error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/approvals/:id', auth, authorize('principal', 'hod'), async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const approval = await Approval.findByIdAndUpdate(req.params.id, { status, remarks, reviewedBy: req.user._id, reviewedAt: new Date() }, { new: true }).populate('department submittedBy reviewedBy');
    if (status === 'approved') {
      await TimetableEntry.updateMany({ department: approval.department, academicYear: approval.academicYear, semester: approval.semester }, { status: 'approved' });
    }
    const io = req.app.get('io');
    io.emit('approval-updated', approval);
    res.json(approval);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── LOCK / UNLOCK / PUBLISH ──────────────────────────────────
router.post('/lock', auth, authorize('principal'), async (req, res) => {
  try {
    const { department, academicYear, semester } = req.body;
    const filter = {};
    if (department) filter.department = department;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = semester;
    await TimetableEntry.updateMany(filter, { isLocked: true, status: 'locked' });
    const io = req.app.get('io');
    io.emit('timetable-locked', filter);
    res.json({ message: 'Timetable locked.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/unlock', auth, authorize('principal'), async (req, res) => {
  try {
    const filter = req.body;
    await TimetableEntry.updateMany(filter, { isLocked: false, status: 'approved' });
    const io = req.app.get('io');
    io.emit('timetable-unlocked', filter);
    res.json({ message: 'Timetable unlocked.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/publish', auth, authorize('coordinator', 'hod', 'principal'), async (req, res) => {
  try {
    const { department, academicYear, semester } = req.body;
    await TimetableEntry.updateMany({ department, academicYear, semester }, { status: 'published' });
    const io = req.app.get('io');
    io.emit('timetable-published', { department, academicYear, semester });
    res.json({ message: 'Timetable published.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── PUBLISH TO STUDENTS ──────────────────────────────────────
router.post('/publish-to-students', auth, authorize('coordinator', 'hod'), async (req, res) => {
  try {
    const { department, academicYear, visible } = req.body;
    const filter = { department, academicYear };
    const result = await TimetableEntry.updateMany(filter, { visibleToStudents: visible !== false });
    const io = req.app.get('io');
    io.emit('timetable-visibility-changed', { department, academicYear, target: 'students', visible: visible !== false });
    res.json({ message: visible !== false ? 'Timetable is now visible to students.' : 'Timetable hidden from students.', modified: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── PUBLISH TO FACULTY ───────────────────────────────────────
router.post('/publish-to-faculty', auth, authorize('coordinator', 'hod'), async (req, res) => {
  try {
    const { department, academicYear, visible } = req.body;
    const filter = { department, academicYear };
    const result = await TimetableEntry.updateMany(filter, { visibleToFaculty: visible !== false });
    const io = req.app.get('io');
    io.emit('timetable-visibility-changed', { department, academicYear, target: 'faculty', visible: visible !== false });
    res.json({ message: visible !== false ? 'Timetable is now visible to faculty.' : 'Timetable hidden from faculty.', modified: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── GET VISIBILITY STATUS ────────────────────────────────────
router.get('/visibility-status', auth, async (req, res) => {
  try {
    const { department, academicYear } = req.query;
    if (!department || !academicYear) return res.json({ visibleToStudents: false, visibleToFaculty: false, totalEntries: 0 });
    
    const totalEntries = await TimetableEntry.countDocuments({ department, academicYear });
    const studentVisible = await TimetableEntry.countDocuments({ department, academicYear, visibleToStudents: true });
    const facultyVisible = await TimetableEntry.countDocuments({ department, academicYear, visibleToFaculty: true });
    
    res.json({
      totalEntries,
      visibleToStudents: studentVisible > 0 && studentVisible === totalEntries,
      visibleToFaculty: facultyVisible > 0 && facultyVisible === totalEntries,
      studentVisibleCount: studentVisible,
      facultyVisibleCount: facultyVisible
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── ROOM USAGE (cross-department) ────────────────────────────
// Returns entries from OTHER departments using rooms, so the timetable editor
// can show which department occupies a shared room at each time slot.
router.get('/room-usage', auth, async (req, res) => {
  try {
    const { academicYear, department } = req.query;
    if (!academicYear || !department) return res.json([]);

    // Find all entries from OTHER departments in the same academic year
    const otherEntries = await TimetableEntry.find({
      academicYear,
      department: { $ne: department },
      room: { $exists: true, $ne: null }
    })
    .populate('department', 'name code')
    .populate('subject', 'name code')
    .populate('faculty', 'name')
    .populate('room', 'name code')
    .populate('timeSlot', 'startTime endTime slotNumber')
    .select('day timeSlot room department subject faculty semester division type batch')
    .lean();

    res.json(otherEntries);
  } catch (error) {
    console.error('GET /timetable/room-usage error:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── VALIDATE HOURS: Check that all subject hours are properly allocated ───
// Supports both new TimetableSlot-based and legacy TimetableEntry-based timetables
router.get('/validate-hours', auth, async (req, res) => {
  try {
    const { semesterId, department, academicYear } = req.query;

    const issues = [];

    // ═══════════════════════════════════════════
    // Path A: Validate NEW system (TimetableSlot + SubjectAllocation)
    // ═══════════════════════════════════════════
    if (semesterId) {
      const allocations = await SubjectAllocation.find({
        semesterId,
        ...(department ? { departmentId: department } : {}),
        status: 'approved'
      });

      const slots = await TimetableSlot.find({
        semesterId,
        ...(department ? { department } : {})
      });

      // Load non-break time slots for consecutive-pair checking
      const activeSem = await SemesterConfig.findById(semesterId);
      const timeSlots = activeSem
        ? await TimeSlot.find({ academicYear: activeSem.academicYear, ...(department ? { department } : {}), isActive: true, isBreak: false }).sort({ slotNumber: 1 })
        : [];

      // Build consecutive pair start-times for validation
      const consecutiveStartTimes = new Set();
      for (let i = 0; i < timeSlots.length - 1; i++) {
        if (timeSlots[i].endTime === timeSlots[i + 1].startTime) {
          consecutiveStartTimes.add(`${timeSlots[i].startTime}|${timeSlots[i + 1].startTime}`);
        }
      }

      for (const alloc of allocations) {
        const subCode = alloc.subject?.code;
        const classId = alloc.classId?.toString();
        if (!subCode || !classId) continue;

        // --- Theory hours validation ---
        const requiredTheoryHours = alloc.theoryHours || 0;
        const placedTheorySlots = slots.filter(s =>
          s.classId?.toString() === classId &&
          s.subjectCode === subCode &&
          (s.slotType === 'theory' || s.slotType === 'OE')
        );
        const actualTheoryHours = placedTheorySlots.length;

        if (requiredTheoryHours > 0 && actualTheoryHours !== requiredTheoryHours) {
          issues.push({
            type: 'theory_hours_mismatch',
            severity: 'error',
            subjectCode: subCode,
            subjectName: alloc.subject?.name,
            classId,
            required: requiredTheoryHours,
            actual: actualTheoryHours,
            message: `${subCode}: Required ${requiredTheoryHours} theory hours but ${actualTheoryHours} are allocated`
          });
        }

        // --- Practical hours validation ---
        if (alloc.batches && alloc.batches.length > 0) {
          for (const batch of alloc.batches) {
            const requiredPracHours = batch.hours || 2;
            const placedPracSlots = slots.filter(s =>
              s.classId?.toString() === classId &&
              s.subjectCode === subCode &&
              s.slotType === 'practical' &&
              s.batch === batch.batchLabel
            );
            const actualPracHours = placedPracSlots.length;

            if (actualPracHours !== requiredPracHours) {
              issues.push({
                type: 'practical_hours_mismatch',
                severity: 'error',
                subjectCode: subCode,
                subjectName: alloc.subject?.name,
                classId,
                batch: batch.batchLabel,
                required: requiredPracHours,
                actual: actualPracHours,
                message: `${subCode} (${batch.batchLabel}): Required ${requiredPracHours} practical hours but ${actualPracHours} are allocated`
              });
            }

            // Check consecutive slots for practicals (must be back-to-back)
            if (placedPracSlots.length >= 2) {
              // Group by day
              const byDay = {};
              for (const s of placedPracSlots) {
                if (!byDay[s.day]) byDay[s.day] = [];
                byDay[s.day].push(s);
              }

              for (const [day, daySlots] of Object.entries(byDay)) {
                if (daySlots.length >= 2) {
                  // Sort by startTime
                  daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
                  // Check each pair is consecutive
                  for (let i = 0; i < daySlots.length - 1; i++) {
                    const pair = `${daySlots[i].startTime}|${daySlots[i + 1].startTime}`;
                    if (!consecutiveStartTimes.has(pair)) {
                      issues.push({
                        type: 'practical_not_consecutive',
                        severity: 'error',
                        subjectCode: subCode,
                        subjectName: alloc.subject?.name,
                        classId,
                        batch: batch.batchLabel,
                        day,
                        slots: daySlots.map(s => s.startTime),
                        message: `${subCode} (${batch.batchLabel}): Practical on ${day} is NOT in consecutive slots (${daySlots.map(s => s.startTime).join(', ')})`
                      });
                    }
                  }
                }
              }

              // Check practicals aren't split across days (should be same day for consecutive)
              const uniqueDays = Object.keys(byDay);
              if (uniqueDays.length > 1) {
                const singleDaySlots = uniqueDays.filter(d => byDay[d].length === 1);
                if (singleDaySlots.length > 0) {
                  issues.push({
                    type: 'practical_split_across_days',
                    severity: 'warning',
                    subjectCode: subCode,
                    subjectName: alloc.subject?.name,
                    classId,
                    batch: batch.batchLabel,
                    days: uniqueDays,
                    message: `${subCode} (${batch.batchLabel}): Practical hours split across days (${uniqueDays.join(', ')}) — individual hours are not in 2-hour blocks`
                  });
                }
              }
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════
    // Path B: Validate LEGACY system (TimetableEntry)
    // ═══════════════════════════════════════════
    if (academicYear && department) {
      const entries = await TimetableEntry.find({
        department,
        academicYear
      }).populate('subject', 'code name weeklyHours theoryHours practicalHours')
        .populate('timeSlot', '_id startTime endTime slotNumber');

      const timeSlots = await TimeSlot.find({
        academicYear,
        department,
        isActive: true,
        isBreak: false
      }).sort({ slotNumber: 1 });

      // Build a Set of valid TimeSlot IDs (only slots that still exist in DB)
      const validSlotIds = new Set(timeSlots.map(ts => ts._id.toString()));

      const consecutivePairIds = new Set();
      for (let i = 0; i < timeSlots.length - 1; i++) {
        if (timeSlots[i].endTime === timeSlots[i + 1].startTime) {
          consecutivePairIds.add(`${timeSlots[i]._id}|${timeSlots[i + 1]._id}`);
        }
      }

      // Group entries by subject + division + semester
      const grouped = {};
      for (const e of entries) {
        if (!e.subject) continue;
        const key = `${e.subject._id}-${e.division}-${e.semester}`;
        if (!grouped[key]) grouped[key] = { subject: e.subject, division: e.division, semester: e.semester, theory: [], practical: [], dangling: [] };
        
        // Track dangling entries (point to deleted time slots)
        const slotId = e.timeSlot?._id?.toString() || e.timeSlot?.toString();
        if (slotId && !validSlotIds.has(slotId)) {
          grouped[key].dangling.push(e);
          continue; // Don't count dangling entries in hours
        }
        
        if (e.type === 'theory' || e.type === 'lecture') {
          grouped[key].theory.push(e);
        } else if (e.type === 'practical' || e.type === 'lab') {
          grouped[key].practical.push(e);
        }
      }

      for (const [key, group] of Object.entries(grouped)) {
        const sub = group.subject;
        // Use theoryHours if set, else fall back to weeklyHours (for subjects without detailed breakdown)
        const expectedTheory = sub.theoryHours > 0 ? sub.theoryHours : (sub.weeklyHours || 0);
        const expectedPractical = sub.practicalHours || 0;

        // Report dangling references as warnings
        if (group.dangling.length > 0) {
          issues.push({
            type: 'dangling_timeslot_ref',
            severity: 'warning',
            subjectCode: sub.code,
            subjectName: sub.name,
            division: group.division,
            semester: group.semester,
            count: group.dangling.length,
            message: `${sub.code} (Div ${group.division}, Sem ${group.semester}): ${group.dangling.length} entr${group.dangling.length === 1 ? 'y references' : 'ies reference'} a deleted time slot — run Redistribute to clean up`
          });
        }

        if (expectedTheory > 0 && group.theory.length !== expectedTheory) {
          issues.push({
            type: 'theory_hours_mismatch',
            severity: 'error',
            subjectCode: sub.code,
            subjectName: sub.name,
            division: group.division,
            semester: group.semester,
            required: expectedTheory,
            actual: group.theory.length,
            message: `${sub.code} (Div ${group.division}, Sem ${group.semester}): Required ${expectedTheory} theory hours but ${group.theory.length} are allocated`
          });
        }

        // Check practical consecutive slots — only for entries pointing to still-valid slots
        if (expectedPractical > 0 && group.practical.length >= 2) {
          const byDay = {};
          for (const e of group.practical) {
            if (!byDay[e.day]) byDay[e.day] = [];
            byDay[e.day].push(e);
          }

          for (const [day, dayEntries] of Object.entries(byDay)) {
            if (dayEntries.length >= 2) {
              dayEntries.sort((a, b) => {
                const aSlot = timeSlots.find(ts => ts._id.toString() === (a.timeSlot?._id?.toString() || a.timeSlot?.toString()));
                const bSlot = timeSlots.find(ts => ts._id.toString() === (b.timeSlot?._id?.toString() || b.timeSlot?.toString()));
                return (aSlot?.slotNumber || 0) - (bSlot?.slotNumber || 0);
              });
              for (let i = 0; i < dayEntries.length - 1; i++) {
                const tsA = dayEntries[i].timeSlot?._id?.toString() || dayEntries[i].timeSlot?.toString();
                const tsB = dayEntries[i + 1].timeSlot?._id?.toString() || dayEntries[i + 1].timeSlot?.toString();
                // Skip check if either slot is no longer in the DB
                if (!validSlotIds.has(tsA) || !validSlotIds.has(tsB)) continue;
                const pair = `${tsA}|${tsB}`;
                if (!consecutivePairIds.has(pair)) {
                  issues.push({
                    type: 'practical_not_consecutive',
                    severity: 'error',
                    subjectCode: sub.code,
                    subjectName: sub.name,
                    division: group.division,
                    semester: group.semester,
                    day,
                    message: `${sub.code} (Div ${group.division}): Practical on ${day} is NOT in consecutive time slots`
                  });
                }
              }
            }
          }
        }
      }
    }

    // Calculate summary
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    res.json({
      valid: errorCount === 0,
      totalIssues: issues.length,
      errors: errorCount,
      warnings: warningCount,
      issues
    });
  } catch (error) {
    console.error('validate-hours error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── REDISTRIBUTE: Fix subject hours and practical placement after slot changes ───
router.post('/redistribute', auth, authorize('coordinator', 'hod', 'admin'), async (req, res) => {
  try {
    const { semesterId, department, academicYear } = req.body;
    const io = req.app.get('io');
    const fixes = [];

    if (semesterId) {
      // ═══════════════════════════════════════════
      // New system: Fix TimetableSlot entries
      // ═══════════════════════════════════════════
      const allocations = await SubjectAllocation.find({
        semesterId,
        ...(department ? { departmentId: department } : {}),
        status: 'approved'
      }).populate('theoryFacultyId');

      const slots = await TimetableSlot.find({
        semesterId,
        ...(department ? { department } : {})
      });

      const activeSem = await SemesterConfig.findById(semesterId);
      if (!activeSem) return res.status(400).json({ message: 'Semester config not found.' });

      const timeSlots = await TimeSlot.find({
        academicYear: activeSem.academicYear,
        ...(department ? { department } : {}),
        isActive: true,
        isBreak: false
      }).sort({ slotNumber: 1 });

      const allTimeSlots = await TimeSlot.find({
        academicYear: activeSem.academicYear,
        ...(department ? { department } : {}),
        isActive: true
      }).sort({ slotNumber: 1 });

      // Build consecutive pairs
      const consecutivePairs = [];
      for (let i = 0; i < timeSlots.length - 1; i++) {
        if (timeSlots[i].endTime === timeSlots[i + 1].startTime) {
          consecutivePairs.push([timeSlots[i], timeSlots[i + 1]]);
        }
      }

      const Class = require('../models/Class');
      const classes = await Class.find({ department: { $in: activeSem.departments }, isActive: true });
      const Room = require('../models/Room');
      const rooms = await Room.find({ isActive: true }).sort({ capacity: -1 });

      // Build occupancy from existing slots
      const occupied = {};
      const isOccupied = (key) => !!occupied[key];
      const markOccupied = (keys) => keys.forEach(k => occupied[k] = true);
      const unmarkOccupied = (keys) => keys.forEach(k => delete occupied[k]);

      // Load all existing slot occupancy
      for (const slot of slots) {
        const keys = [];
        if (slot.batch) {
          keys.push(`c-${slot.classId}-${slot.batch}-${slot.day}-${slot.startTime}`);
        } else {
          keys.push(`c-${slot.classId}-all-${slot.day}-${slot.startTime}`);
          const cls = classes.find(c => c._id.toString() === slot.classId?.toString());
          if (cls) {
            for (const bl of (cls.batchLabels || [])) {
              keys.push(`c-${slot.classId}-${bl}-${slot.day}-${slot.startTime}`);
            }
          }
        }
        if (slot.facultyId) keys.push(`f-${slot.facultyId}-${slot.day}-${slot.startTime}`);
        if (slot.roomId) keys.push(`r-${slot.roomId}-${slot.day}-${slot.startTime}`);
        markOccupied(keys);
      }

      const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

      for (const alloc of allocations) {
        const subCode = alloc.subject?.code;
        const classId = alloc.classId?.toString();
        if (!subCode || !classId) continue;

        // --- Fix Theory Hours ---
        const requiredTheoryHours = alloc.theoryHours || 0;
        const placedTheorySlots = slots.filter(s =>
          s.classId?.toString() === classId &&
          s.subjectCode === subCode &&
          (s.slotType === 'theory' || s.slotType === 'OE')
        );
        const actualTheoryHours = placedTheorySlots.length;

        if (requiredTheoryHours > 0 && actualTheoryHours < requiredTheoryHours) {
          // Need to add more theory slots
          const needed = requiredTheoryHours - actualTheoryHours;
          let added = 0;

          for (const day of DAYS) {
            if (added >= needed) break;
            for (const ts of timeSlots) {
              if (added >= needed) break;
              const classKey = `c-${classId}-all-${day}-${ts.startTime}`;
              if (isOccupied(classKey)) continue;

              const facultyId = alloc.theoryFacultyId?._id || alloc.theoryFacultyId;
              if (facultyId && isOccupied(`f-${facultyId}-${day}-${ts.startTime}`)) continue;

              // Find a room
              let selectedRoom = null;
              for (const room of rooms) {
                if (room.type === 'lab') continue;
                if (!isOccupied(`r-${room._id}-${day}-${ts.startTime}`)) {
                  selectedRoom = room;
                  break;
                }
              }
              if (!selectedRoom) continue;

              const cls = classes.find(c => c._id.toString() === classId);
              const keys = [classKey, `r-${selectedRoom._id}-${day}-${ts.startTime}`];
              if (facultyId) keys.push(`f-${facultyId}-${day}-${ts.startTime}`);
              if (cls) {
                for (const bl of (cls.batchLabels || [])) {
                  keys.push(`c-${classId}-${bl}-${day}-${ts.startTime}`);
                }
              }
              markOccupied(keys);

              const newSlot = new TimetableSlot({
                semesterId,
                department: alloc.departmentId,
                classId,
                day,
                startTime: ts.startTime,
                endTime: ts.endTime,
                slotNumber: ts.slotNumber,
                subjectCode: subCode,
                subjectName: alloc.subject?.name,
                facultyId,
                roomId: selectedRoom._id,
                roomName: selectedRoom.name,
                slotType: 'theory',
                isLocked: false,
                isClasswide: true,
                status: 'draft',
                createdBy: req.user._id,
                lastModifiedBy: req.user._id
              });
              await newSlot.save();
              added++;
              fixes.push({ action: 'added_theory', subjectCode: subCode, day, time: ts.startTime });
            }
          }
        } else if (requiredTheoryHours > 0 && actualTheoryHours > requiredTheoryHours) {
          // Too many — remove excess (keep first N)
          const excess = placedTheorySlots.slice(requiredTheoryHours);
          for (const exSlot of excess) {
            // Free up occupancy
            const keys = [];
            keys.push(`c-${classId}-all-${exSlot.day}-${exSlot.startTime}`);
            if (exSlot.facultyId) keys.push(`f-${exSlot.facultyId}-${exSlot.day}-${exSlot.startTime}`);
            if (exSlot.roomId) keys.push(`r-${exSlot.roomId}-${exSlot.day}-${exSlot.startTime}`);
            unmarkOccupied(keys);

            await TimetableSlot.findByIdAndDelete(exSlot._id);
            fixes.push({ action: 'removed_excess_theory', subjectCode: subCode, day: exSlot.day, time: exSlot.startTime });
          }
        }

        // --- Fix Practical Consecutive Slots ---
        if (alloc.batches && alloc.batches.length > 0) {
          for (const batch of alloc.batches) {
            const requiredPracHours = batch.hours || 2;
            const placedPracSlots = slots.filter(s =>
              s.classId?.toString() === classId &&
              s.subjectCode === subCode &&
              s.slotType === 'practical' &&
              s.batch === batch.batchLabel
            );

            // Check if practicals are consecutive
            if (placedPracSlots.length === requiredPracHours) {
              // Check consecutiveness
              const byDay = {};
              for (const s of placedPracSlots) {
                if (!byDay[s.day]) byDay[s.day] = [];
                byDay[s.day].push(s);
              }

              let isConsecutive = true;
              for (const [day, daySlots] of Object.entries(byDay)) {
                if (daySlots.length >= 2) {
                  daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
                  for (let i = 0; i < daySlots.length - 1; i++) {
                    if (daySlots[i].endTime !== daySlots[i + 1].startTime) {
                      isConsecutive = false;
                      break;
                    }
                  }
                }
              }

              // If split across days with single slots, they're not consecutive
              const uniqueDays = Object.keys(byDay);
              if (uniqueDays.length > 1) {
                const hasSingle = uniqueDays.some(d => byDay[d].length === 1);
                if (hasSingle && requiredPracHours >= 2) isConsecutive = false;
              }

              if (!isConsecutive) {
                // Remove existing and re-place in consecutive slots
                for (const s of placedPracSlots) {
                  const keys = [];
                  keys.push(`c-${classId}-${batch.batchLabel}-${s.day}-${s.startTime}`);
                  if (s.facultyId) keys.push(`f-${s.facultyId}-${s.day}-${s.startTime}`);
                  if (s.roomId) keys.push(`r-${s.roomId}-${s.day}-${s.startTime}`);
                  unmarkOccupied(keys);
                  await TimetableSlot.findByIdAndDelete(s._id);
                }

                // Re-place in consecutive pair
                let placed = false;
                for (const day of DAYS) {
                  if (placed) break;
                  for (const [ts1, ts2] of consecutivePairs) {
                    if (placed) break;

                    const ck1 = `c-${classId}-${batch.batchLabel}-${day}-${ts1.startTime}`;
                    const ck2 = `c-${classId}-${batch.batchLabel}-${day}-${ts2.startTime}`;
                    if (isOccupied(ck1) || isOccupied(ck2)) continue;
                    if (isOccupied(`c-${classId}-all-${day}-${ts1.startTime}`) || isOccupied(`c-${classId}-all-${day}-${ts2.startTime}`)) continue;

                    const facultyId = batch.facultyId;
                    if (facultyId) {
                      if (isOccupied(`f-${facultyId}-${day}-${ts1.startTime}`) || isOccupied(`f-${facultyId}-${day}-${ts2.startTime}`)) continue;
                    }

                    // Find a lab
                    let labRoom = null;
                    if (batch.labId) {
                      const rk1 = `r-${batch.labId}-${day}-${ts1.startTime}`;
                      const rk2 = `r-${batch.labId}-${day}-${ts2.startTime}`;
                      if (!isOccupied(rk1) && !isOccupied(rk2)) {
                        labRoom = rooms.find(r => r._id.toString() === batch.labId?.toString());
                      }
                    }
                    if (!labRoom) {
                      for (const room of rooms) {
                        if (room.type !== 'lab') continue;
                        const rk1 = `r-${room._id}-${day}-${ts1.startTime}`;
                        const rk2 = `r-${room._id}-${day}-${ts2.startTime}`;
                        if (!isOccupied(rk1) && !isOccupied(rk2)) {
                          labRoom = room;
                          break;
                        }
                      }
                    }
                    if (!labRoom) continue;

                    // Place
                    const keys = [ck1, ck2];
                    if (facultyId) {
                      keys.push(`f-${facultyId}-${day}-${ts1.startTime}`);
                      keys.push(`f-${facultyId}-${day}-${ts2.startTime}`);
                    }
                    keys.push(`r-${labRoom._id}-${day}-${ts1.startTime}`);
                    keys.push(`r-${labRoom._id}-${day}-${ts2.startTime}`);
                    markOccupied(keys);

                    for (const ts of [ts1, ts2]) {
                      const newSlot = new TimetableSlot({
                        semesterId,
                        department: alloc.departmentId,
                        classId,
                        day,
                        startTime: ts.startTime,
                        endTime: ts.endTime,
                        slotNumber: ts.slotNumber,
                        batch: batch.batchLabel,
                        subjectCode: subCode,
                        subjectName: alloc.subject?.name,
                        facultyId,
                        roomId: labRoom._id,
                        roomName: labRoom.name,
                        slotType: 'practical',
                        isLocked: false,
                        isClasswide: false,
                        status: 'draft',
                        createdBy: req.user._id,
                        lastModifiedBy: req.user._id
                      });
                      await newSlot.save();
                    }

                    placed = true;
                    fixes.push({
                      action: 'fixed_practical_consecutive',
                      subjectCode: subCode,
                      batch: batch.batchLabel,
                      day,
                      times: [ts1.startTime, ts2.startTime]
                    });
                  }
                }
              }
            } else if (placedPracSlots.length < requiredPracHours) {
              // Practical hours missing — add them in consecutive pairs
              const missingHours = requiredPracHours - placedPracSlots.length;
              if (missingHours >= 2) {
                let placed = false;
                for (const day of DAYS) {
                  if (placed) break;
                  for (const [ts1, ts2] of consecutivePairs) {
                    if (placed) break;

                    const ck1 = `c-${classId}-${batch.batchLabel}-${day}-${ts1.startTime}`;
                    const ck2 = `c-${classId}-${batch.batchLabel}-${day}-${ts2.startTime}`;
                    if (isOccupied(ck1) || isOccupied(ck2)) continue;
                    if (isOccupied(`c-${classId}-all-${day}-${ts1.startTime}`) || isOccupied(`c-${classId}-all-${day}-${ts2.startTime}`)) continue;

                    const facultyId = batch.facultyId;
                    if (facultyId) {
                      if (isOccupied(`f-${facultyId}-${day}-${ts1.startTime}`) || isOccupied(`f-${facultyId}-${day}-${ts2.startTime}`)) continue;
                    }

                    let labRoom = null;
                    for (const room of rooms) {
                      if (room.type !== 'lab') continue;
                      const rk1 = `r-${room._id}-${day}-${ts1.startTime}`;
                      const rk2 = `r-${room._id}-${day}-${ts2.startTime}`;
                      if (!isOccupied(rk1) && !isOccupied(rk2)) {
                        labRoom = room;
                        break;
                      }
                    }
                    if (!labRoom) continue;

                    const keys = [ck1, ck2];
                    if (facultyId) {
                      keys.push(`f-${facultyId}-${day}-${ts1.startTime}`);
                      keys.push(`f-${facultyId}-${day}-${ts2.startTime}`);
                    }
                    keys.push(`r-${labRoom._id}-${day}-${ts1.startTime}`);
                    keys.push(`r-${labRoom._id}-${day}-${ts2.startTime}`);
                    markOccupied(keys);

                    for (const ts of [ts1, ts2]) {
                      const newSlot = new TimetableSlot({
                        semesterId,
                        department: alloc.departmentId,
                        classId,
                        day,
                        startTime: ts.startTime,
                        endTime: ts.endTime,
                        slotNumber: ts.slotNumber,
                        batch: batch.batchLabel,
                        subjectCode: subCode,
                        subjectName: alloc.subject?.name,
                        facultyId,
                        roomId: labRoom._id,
                        roomName: labRoom.name,
                        slotType: 'practical',
                        isLocked: false,
                        isClasswide: false,
                        status: 'draft',
                        createdBy: req.user._id,
                        lastModifiedBy: req.user._id
                      });
                      await newSlot.save();
                    }
                    placed = true;
                    fixes.push({
                      action: 'added_practical',
                      subjectCode: subCode,
                      batch: batch.batchLabel,
                      day,
                      times: [ts1.startTime, ts2.startTime]
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════
    // Path B: LEGACY system cleanup (TimetableEntry)
    // Delete entries pointing to time slots that no longer exist
    // ═══════════════════════════════════════════
    if (academicYear && department) {
      // Get all valid time slot IDs for this dept+year
      const validTimeSlots = await TimeSlot.find({ academicYear, department, isActive: true }).select('_id');
      const validSlotIdSet = new Set(validTimeSlots.map(ts => ts._id.toString()));

      // Find all TimetableEntry records for this dept+year
      const legacyEntries = await TimetableEntry.find({ department, academicYear }).select('_id timeSlot');

      // Find entries whose timeSlot no longer exists
      const danglingIds = legacyEntries
        .filter(e => {
          const slotId = e.timeSlot?.toString();
          return slotId && !validSlotIdSet.has(slotId);
        })
        .map(e => e._id);

      if (danglingIds.length > 0) {
        await TimetableEntry.deleteMany({ _id: { $in: danglingIds } });
        fixes.push({
          action: 'removed_dangling_entries',
          count: danglingIds.length,
          message: `Removed ${danglingIds.length} timetable entr${danglingIds.length === 1 ? 'y' : 'ies'} referencing deleted time slots`
        });
      }
    }

    if (io) {
      io.emit('timetable-updated', { action: 'redistribute' });
    }

    res.json({
      message: `Redistribution complete. ${fixes.length} fix(es) applied.`,
      fixes
    });
  } catch (error) {
    console.error('redistribute error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── SLOT IMPACT CHECK: What entries are affected by time slot changes ───
router.get('/slot-impact', auth, async (req, res) => {
  try {
    const { timeSlotId, startTime, endTime, academicYear } = req.query;

    const results = { affectedEntries: 0, affectedSlots: 0, brokenPracticals: 0, details: [] };

    // Check legacy TimetableEntry
    if (timeSlotId) {
      const entries = await TimetableEntry.find({ timeSlot: timeSlotId })
        .populate('subject', 'code name')
        .populate('department', 'code name');
      results.affectedEntries = entries.length;
      for (const e of entries) {
        results.details.push({
          type: 'entry',
          subject: e.subject?.code || '?',
          department: e.department?.code || '?',
          division: e.division,
          semester: e.semester,
          day: e.day,
          entryType: e.type,
          batch: e.batch
        });
      }
    }

    // Check new TimetableSlot by startTime
    if (startTime) {
      const slotFilter = { startTime };
      const slotsAffected = await TimetableSlot.find(slotFilter)
        .populate('classId', 'name')
        .populate('department', 'code name');
      results.affectedSlots = slotsAffected.length;

      // Check if any are part of a 2-hour practical block
      for (const s of slotsAffected) {
        if (s.slotType === 'practical') {
          results.brokenPracticals++;
        }
        results.details.push({
          type: 'slot',
          subject: s.subjectCode || '?',
          department: s.department?.code || '?',
          className: s.classId?.name || '?',
          day: s.day,
          slotType: s.slotType,
          batch: s.batch
        });
      }
    }

    results.totalAffected = results.affectedEntries + results.affectedSlots;
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

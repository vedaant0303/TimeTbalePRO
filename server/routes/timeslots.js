const express = require('express');
const TimeSlot = require('../models/TimeSlot');
const TimetableSlot = require('../models/TimetableSlot');
const TimetableEntry = require('../models/TimetableEntry');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// Helper: parse time string like '8:15', '1:30', '03:30', '12:30' into total minutes for sorting
// College schedule runs ~8 AM to ~6 PM, so hours 1-6 are treated as PM (13:00-18:00)
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || '0', 10);
  // Treat hours 1-6 as PM (afternoon) since college schedules don't run at 1 AM
  if (hours >= 1 && hours <= 6) hours += 12;
  return hours * 60 + minutes;
};

// Helper: auto-resequence slot numbers after add/delete — sorted by TIME, not by old slotNumber
// Uses two-pass approach to avoid unique index conflicts on (slotNumber, academicYear)
const resequenceSlots = async (academicYear, department, year, semester) => {
  if (!academicYear || !department) return;
  const filter = { academicYear, department, isActive: true };
  if (year) filter.year = year;
  if (semester) filter.semester = semester;
  const slots = await TimeSlot.find(filter);
  if (slots.length === 0) return;
  slots.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
  
  const tempOps = slots.map((slot, i) => ({
    updateOne: {
      filter: { _id: slot._id },
      update: { $set: { slotNumber: 10000 + i } }
    }
  }));
  await TimeSlot.bulkWrite(tempOps);
  
  const finalOps = slots.map((slot, i) => ({
    updateOne: {
      filter: { _id: slot._id },
      update: { $set: { slotNumber: i + 1 } }
    }
  }));
  await TimeSlot.bulkWrite(finalOps);
};

router.get('/', auth, async (req, res) => {
  try {
    const { academicYear, department, year, semester } = req.query;
    const filter = { isActive: true };
    if (academicYear) filter.academicYear = academicYear;
    if (department) filter.department = department;
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = parseInt(semester);
    const slots = await TimeSlot.find(filter).sort({ slotNumber: 1 }).lean();
    slots.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/', auth, authorize('dean', 'admin', 'coordinator'), async (req, res) => {
  try {
    const slot = new TimeSlot(req.body);
    await slot.save();
    await resequenceSlots(slot.academicYear, slot.department, slot.year, slot.semester);
    const io = req.app.get('io');
    io.emit('timeslots-updated', slot);
    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.post('/bulk', auth, authorize('dean', 'admin', 'coordinator'), async (req, res) => {
  try {
    const { slots, academicYear, department, year, semester } = req.body;
    const deleteFilter = { academicYear, department };
    if (year) deleteFilter.year = year;
    if (semester) deleteFilter.semester = semester;
    await TimeSlot.deleteMany(deleteFilter);
    const created = await TimeSlot.insertMany(
      slots.map((s, i) => ({ ...s, slotNumber: i + 1, academicYear, department, ...(year ? { year } : {}), ...(semester ? { semester } : {}) }))
    );
    const io = req.app.get('io');
    io.emit('timeslots-updated', created);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.put('/:id', auth, authorize('dean', 'admin', 'coordinator'), async (req, res) => {
  try {
    // Only update safe fields, don't overwrite slotNumber or _id
    const { startTime, endTime, isBreak, breakType, academicYear, department, isActive } = req.body;
    const updateData = {};
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (isBreak !== undefined) updateData.isBreak = isBreak;
    if (breakType !== undefined) updateData.breakType = breakType;
    if (academicYear !== undefined) updateData.academicYear = academicYear;
    if (department !== undefined) updateData.department = department;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Check impact before update: if times change, existing entries may be affected
    const existing = await TimeSlot.findById(req.params.id);
    if (existing && (startTime !== undefined && startTime !== existing.startTime || endTime !== undefined && endTime !== existing.endTime)) {
      const affectedEntries = await TimetableEntry.countDocuments({ timeSlot: req.params.id });
      const affectedSlots = await TimetableSlot.countDocuments({ startTime: existing.startTime });
      if (affectedEntries > 0 || affectedSlots > 0) {
        // Still allow update but include warning in response
        const slot = await TimeSlot.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        const io = req.app.get('io');
        io.emit('timeslots-updated', slot);
        return res.json({
          ...slot.toObject(),
          _warning: `This change affects ${affectedEntries} timetable entries and ${affectedSlots} timetable slots. Run "Validate & Redistribute" to fix hour allocations.`,
          _affectedCount: affectedEntries + affectedSlots
        });
      }
    }

    const slot = await TimeSlot.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!slot) return res.status(404).json({ message: 'Time slot not found.' });
    const io = req.app.get('io');
    io.emit('timeslots-updated', slot);
    res.json(slot);
  } catch (error) {
    console.error('Timeslot PUT error:', error);
    res.status(500).json({ message: 'Failed to update time slot.', error: error.message });
  }
});

router.delete('/:id', auth, authorize('dean', 'admin', 'coordinator'), async (req, res) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Time slot not found.' });

    // Check for affected timetable data
    const affectedEntries = await TimetableEntry.countDocuments({ timeSlot: req.params.id });
    const affectedSlots = await TimetableSlot.countDocuments({ startTime: slot.startTime });
    const affectedPracticals = await TimetableSlot.countDocuments({ startTime: slot.startTime, slotType: 'practical' });

    // If force flag not set and entries exist, return warning
    if ((affectedEntries > 0 || affectedSlots > 0) && req.query.force !== 'true') {
      return res.status(409).json({
        message: `This time slot has ${affectedEntries + affectedSlots} timetable entries using it (${affectedPracticals} practicals). Deleting may break hour allocations and consecutive practical slots.`,
        affectedEntries,
        affectedSlots,
        affectedPracticals,
        requiresForce: true,
        hint: 'Add ?force=true to delete anyway, then use "Validate & Redistribute" to fix.'
      });
    }

    await TimeSlot.findByIdAndDelete(req.params.id);
    await resequenceSlots(slot.academicYear, slot.department, slot.year, slot.semester);
    const io = req.app.get('io');
    io.emit('timeslots-updated', { deleted: req.params.id });
    res.json({
      message: 'Time slot deleted.',
      warning: (affectedEntries + affectedSlots) > 0
        ? `${affectedEntries + affectedSlots} timetable entries were using this slot. Please run "Validate & Redistribute" to fix hour allocations.`
        : null
    });
  } catch (error) {
    console.error('Timeslot DELETE error:', error);
    res.status(500).json({ message: 'Failed to delete time slot.', error: error.message });
  }
});

// POST /api/timeslots/seed-defaults — Delete all and create the standard 8:15-5:30 slots
router.post('/seed-defaults', auth, authorize('dean', 'admin', 'coordinator'), async (req, res) => {
  try {
    const { academicYear, department, year, semester } = req.body;
    if (!academicYear) return res.status(400).json({ message: 'Academic year is required.' });
    if (!department) return res.status(400).json({ message: 'Department is required.' });

    // Build scope filter
    const scopeFilter = { academicYear, department };
    if (year) scopeFilter.year = parseInt(year);
    if (semester) scopeFilter.semester = parseInt(semester);

    // Delete existing slots within this scope
    await TimeSlot.deleteMany(scopeFilter);

    const extraFields = {};
    if (year) extraFields.year = parseInt(year);
    if (semester) extraFields.semester = parseInt(semester);

    const defaults = [
      { slotNumber: 1, startTime: '8:15', endTime: '9:15', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 2, startTime: '9:15', endTime: '10:15', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 3, startTime: '10:15', endTime: '11:15', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 4, startTime: '11:15', endTime: '11:30', isBreak: true, breakType: 'short', academicYear, department, ...extraFields },
      { slotNumber: 5, startTime: '11:30', endTime: '12:30', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 6, startTime: '12:30', endTime: '1:30', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 7, startTime: '1:30', endTime: '2:30', isBreak: true, breakType: 'lunch', academicYear, department, ...extraFields },
      { slotNumber: 8, startTime: '2:30', endTime: '3:30', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 9, startTime: '3:30', endTime: '4:30', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
      { slotNumber: 10, startTime: '4:30', endTime: '5:30', isBreak: false, breakType: 'none', academicYear, department, ...extraFields },
    ];

    const created = await TimeSlot.insertMany(defaults);
    const io = req.app.get('io');
    io.emit('timeslots-updated', created);
    const scopeLabel = year ? ` for Year ${year}${semester ? ` Sem ${semester}` : ''}` : '';
    res.status(201).json({ message: `${created.length} default time slots created (8:15-5:30)${scopeLabel}.`, slots: created });
  } catch (error) {
    console.error('Seed Defaults Error:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// ─── IMPACT CHECK: Preview what entries are affected by a time slot ───
router.get('/impact/:id', auth, async (req, res) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Time slot not found.' });

    const affectedEntries = await TimetableEntry.find({ timeSlot: req.params.id })
      .populate('subject', 'code name')
      .populate('department', 'code name')
      .select('day subject department division semester type batch');

    const affectedSlots = await TimetableSlot.find({ startTime: slot.startTime })
      .populate('classId', 'name')
      .populate('department', 'code name')
      .select('day subjectCode subjectName department classId slotType batch');

    const practicalCount = affectedSlots.filter(s => s.slotType === 'practical').length;

    res.json({
      timeSlot: slot,
      affectedEntries: affectedEntries.length,
      affectedSlots: affectedSlots.length,
      brokenPracticals: practicalCount,
      totalAffected: affectedEntries.length + affectedSlots.length,
      entries: affectedEntries,
      slots: affectedSlots
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

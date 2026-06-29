const express = require('express');
const TimetableSlot = require('../models/TimetableSlot');
const TimetableEntry = require('../models/TimetableEntry');
const Class = require('../models/Class');
const Room = require('../models/Room');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const TimeSlot = require('../models/TimeSlot');
const { auth } = require('../middleware/auth');
const { requireAnyPermission } = require('../middleware/permissions');
const router = express.Router();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SLOT_COLORS = {
  theory: { fill: 'EBF3FB', font: '1a73e8' },
  practical: { fill: 'FFFBEB', font: 'f59e0b' },
  miniproject: { fill: 'E8F5E9', font: '16a34a' },
  majorproject: { fill: 'E8F5E9', font: '16a34a' },
  DLOC: { fill: 'F3E5F5', font: '7c3aed' },
  ILOC: { fill: 'F3E5F5', font: '7c3aed' },
  honours: { fill: 'F3E5F5', font: '7c3aed' },
  combined: { fill: 'FFF3E0', font: 'ea580c' },
  break: { fill: 'E0E0E0', font: '666666' },
  OE: { fill: 'EBF3FB', font: '1a73e8' }
};

// Helper: build timetable grid from slots
function buildGrid(slots, timeSlotsList) {
  const grid = {};
  for (const day of DAYS) {
    grid[day] = {};
    for (const ts of timeSlotsList) {
      grid[day][ts.startTime] = {
        startTime: ts.startTime,
        endTime: ts.endTime,
        slotNumber: ts.slotNumber,
        isBreak: ts.isBreak,
        entries: []
      };
    }
  }

  for (const slot of slots) {
    if (grid[slot.day] && grid[slot.day][slot.startTime]) {
      grid[slot.day][slot.startTime].entries.push(slot);
    }
  }

  return grid;
}

// Helper: format cell content for XLSX
function formatCellContent(entries) {
  if (!entries || entries.length === 0) return '';

  if (entries.length === 1 && !entries[0].batch) {
    // Theory
    const e = entries[0];
    const faculty = e.facultyShortCode || e.facultyName || '';
    const room = e.roomName || '';
    return `${e.subjectCode} (${faculty})\nLect-${room.replace('Lecture ', '').replace('Lab ', '')}`;
  }

  // Multiple batches in same slot
  return entries.map(e => {
    const faculty = e.facultyShortCode || e.facultyName || '';
    const room = e.roomName || '';
    const roomShort = room.replace('Lecture ', '').replace('Lab ', '');
    const batch = e.batch || '';
    return `${batch} ${e.subjectCode}(${faculty}) ${roomShort}`;
  }).join('\n');
}

// GET /api/export/excel/:semId
router.get('/excel/:semId', auth, requireAnyPermission(['export:all', 'export:own']), async (req, res) => {
  try {
    const { view, id } = req.query;
    const semId = req.params.semId;

    const timeSlotsList = await TimeSlot.find({ isActive: true }).sort({ slotNumber: 1 });

    let data = {};

    if (view === 'class' && id) {
      const cls = await Class.findById(id).populate('department coordinator');
      const slots = await TimetableSlot.find({ classId: id, semesterId: semId }).sort({ day: 1, slotNumber: 1 });
      data[cls.name] = { class: cls, slots, grid: buildGrid(slots, timeSlotsList) };
    } else if (view === 'faculty' && id) {
      const user = await User.findById(id);
      const slots = await TimetableSlot.find({ facultyId: id, semesterId: semId }).sort({ day: 1, slotNumber: 1 });
      data[`Faculty_${user.name}`] = { faculty: user, slots, grid: buildGrid(slots, timeSlotsList) };
    } else if (view === 'room' && id) {
      const room = await Room.findById(id);
      const slots = await TimetableSlot.find({ roomId: id, semesterId: semId }).sort({ day: 1, slotNumber: 1 });
      data[room.name] = { room, slots, grid: buildGrid(slots, timeSlotsList) };
    } else {
      // Master — all classes
      const classes = await Class.find({ isActive: true }).populate('department coordinator').sort({ name: 1 });
      for (const cls of classes) {
        const slots = await TimetableSlot.find({ classId: cls._id, semesterId: semId }).sort({ day: 1, slotNumber: 1 });
        if (slots.length > 0) {
          data[cls.name] = { class: cls, slots, grid: buildGrid(slots, timeSlotsList) };
        }
      }

      // Room sheets
      const rooms = await Room.find({ isActive: true }).sort({ name: 1 });
      for (const room of rooms) {
        const slots = await TimetableSlot.find({ roomId: room._id, semesterId: semId }).sort({ day: 1, slotNumber: 1 });
        if (slots.length > 0) {
          data[room.code] = { room, slots, grid: buildGrid(slots, timeSlotsList) };
        }
      }
    }

    // Build JSON response (client-side will use xlsx library to create workbook)
    const sheets = {};
    for (const [sheetName, sheetData] of Object.entries(data)) {
      const rows = [
        ['Vidyavardhini\'s College of Engineering & Technology'],
        [sheetData.class?.department?.name || sheetData.faculty?.name || sheetData.room?.name || ''],
        [`Academic Year: ${timeSlotsList[0]?.academicYear || ''}`],
        [''],
        [`Class: ${sheetData.class?.name || ''}`],
        ['']
      ];

      // Header row
      const headerRow = ['Day/Time'];
      for (const ts of timeSlotsList) {
        if (ts.isBreak) {
          headerRow.push('BREAK');
        } else {
          headerRow.push(`${ts.startTime}-${ts.endTime}`);
        }
      }
      rows.push(headerRow);

      // Data rows
      for (const day of DAYS) {
        const row = [day];
        for (const ts of timeSlotsList) {
          if (ts.isBreak) {
            row.push({ value: 'BREAK', color: SLOT_COLORS.break });
          } else {
            const cell = sheetData.grid[day]?.[ts.startTime];
            if (cell && cell.entries.length > 0) {
              const content = formatCellContent(cell.entries);
              const slotType = cell.entries[0].slotType || 'theory';
              row.push({ value: content, color: SLOT_COLORS[slotType] || SLOT_COLORS.theory });
            } else {
              row.push('');
            }
          }
        }
        rows.push(row);
      }

      sheets[sheetName] = { rows, colors: SLOT_COLORS };
    }

    res.json({
      sheets,
      timeSlots: timeSlotsList,
      meta: {
        collegeName: "Vidyavardhini's College of Engineering & Technology",
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

// GET /api/export/pdf/:semId — returns same data, client renders PDF
router.get('/pdf/:semId', auth, requireAnyPermission(['export:all', 'export:own']), async (req, res) => {
  try {
    // Reuse same logic as excel
    const { view, id } = req.query;
    const semId = req.params.semId;

    const timeSlotsList = await TimeSlot.find({ isActive: true }).sort({ slotNumber: 1 });
    let filter = { semesterId: semId };

    if (view === 'class' && id) filter.classId = id;
    else if (view === 'faculty' && id) filter.facultyId = id;
    else if (view === 'room' && id) filter.roomId = id;

    const slots = await TimetableSlot.find(filter).sort({ day: 1, slotNumber: 1 });
    const grid = buildGrid(slots, timeSlotsList);

    res.json({
      slots,
      grid,
      timeSlots: timeSlotsList,
      days: DAYS,
      colors: SLOT_COLORS,
      meta: {
        collegeName: "Vidyavardhini's College of Engineering & Technology",
        paperSize: 'A3',
        orientation: 'landscape',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

module.exports = router;

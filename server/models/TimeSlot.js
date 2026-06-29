const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  slotNumber: { type: Number, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isBreak: { type: Boolean, default: false },
  breakType: { type: String, enum: ['short', 'lunch', 'none'], default: 'none' },
  academicYear: { type: String, required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  year: { type: Number },      // e.g. 2 (SE), 3 (TE), 4 (BE)
  semester: { type: Number },   // e.g. 3, 4, 5, 6, 7, 8
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Compound index: unique per slot within a specific scope
// year+semester are optional — null values are treated as "all years/semesters"
timeSlotSchema.index(
  { slotNumber: 1, academicYear: 1, department: 1, year: 1, semester: 1 },
  { unique: true }
);

module.exports = mongoose.model('TimeSlot', timeSlotSchema);

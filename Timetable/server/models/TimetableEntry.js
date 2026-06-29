const mongoose = require('mongoose');

const timetableEntrySchema = new mongoose.Schema({
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true },
  timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  division: { type: String, required: true },
  semester: { type: Number, required: true },
  academicYear: { type: String, required: true },
  type: { type: String, enum: ['theory', 'practical', 'tutorial', 'project'], default: 'theory' },
  batch: { type: String, default: '' },  // e.g. 'B1', 'B2', 'B1+B2' for combined
  isLocked: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'published', 'locked'], default: 'draft' },
  visibleToStudents: { type: Boolean, default: false },
  visibleToFaculty: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Compound index for clash detection
timetableEntrySchema.index({ day: 1, timeSlot: 1, faculty: 1, academicYear: 1 });
timetableEntrySchema.index({ day: 1, timeSlot: 1, room: 1, academicYear: 1 });
timetableEntrySchema.index({ day: 1, timeSlot: 1, division: 1, department: 1, academicYear: 1 });

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);

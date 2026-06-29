const mongoose = require('mongoose');

const academicCalendarSchema = new mongoose.Schema({
  academicYear: { type: String, required: true, unique: true },
  startDate: { type: Date },
  endDate: { type: Date },
  semesters: [{
    name: { type: String },
    number: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    type: { type: String, enum: ['odd', 'even'] }
  }],
  holidays: [{
    name: { type: String },
    date: { type: Date },
    type: { type: String, enum: ['national', 'state', 'institutional', 'exam', 'festival'] }
  }],
  events: [{
    name: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    type: { type: String, enum: ['exam', 'festival', 'workshop', 'other'] },
    blocksSchedule: { type: Boolean, default: false }
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AcademicCalendar', academicCalendarSchema);

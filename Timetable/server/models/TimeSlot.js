const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  slotNumber: { type: Number, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isBreak: { type: Boolean, default: false },
  breakType: { type: String, enum: ['short', 'lunch', 'none'], default: 'none' },
  academicYear: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

timeSlotSchema.index({ slotNumber: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('TimeSlot', timeSlotSchema);

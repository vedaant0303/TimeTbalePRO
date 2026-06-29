const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  semester: { type: Number, required: true },
  credits: { type: Number, required: true },
  weeklyHours: { type: Number, required: true },
  theoryHours: { type: Number, default: 0 },
  practicalHours: { type: Number, default: 0 },
  tutorialHours: { type: Number, default: 0 },
  type: { type: String, enum: ['theory', 'practical', 'tutorial', 'project', 'OE', 'DLOC', 'ILOC', 'honours', 'combined'], default: 'theory' },
  faculty: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  requiresLab: { type: Boolean, default: false },
  isElective: { type: Boolean, default: false },
  isDLOC: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);

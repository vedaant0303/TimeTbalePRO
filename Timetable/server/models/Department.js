const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  hod: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  divisions: [{ type: String }],
  semesters: [{ type: Number }],
  batchGroups: [{ type: String }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);

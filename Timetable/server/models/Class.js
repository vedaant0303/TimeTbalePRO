const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },            // "SE1", "TE2", "BE"
  year: { type: String, enum: ['SE', 'TE', 'BE', 'FE'], required: true },
  divisionNumber: { type: Number, required: true },               // 1, 2, 3
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  semester: { type: Number },                                     // current semester number
  batchCount: { type: Number, default: 4 },                       // 3 for BE, 4 for SE/TE
  batchLabels: { type: [String], default: ['B1', 'B2', 'B3', 'B4'] },
  studentCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

classSchema.index({ name: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);

const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  academicYear: { type: String, required: true },
  semester: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  remarks: { type: String },
  level: { type: String, enum: ['hod', 'principal'], default: 'hod' }
}, { timestamps: true });

module.exports = mongoose.model('Approval', approvalSchema);

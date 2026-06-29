const mongoose = require('mongoose');

const subjectAllocationSchema = new mongoose.Schema({
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'SemesterConfig', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: {
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['theory', 'practical', 'project', 'OE', 'DLOC', 'ILOC', 'honours', 'combined'],
      default: 'theory'
    }
  },
  theoryHours: { type: Number, default: 0 },
  theoryFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  theoryRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  batches: [{
    batchLabel: String,
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    hours: { type: Number, default: 2 }
  }],
  isCombinedBatch: { type: Boolean, default: false },
  combinedGroups: [{
    batches: [String],
    type: { type: String, enum: ['theory', 'practical'], default: 'theory' },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' }
  }],
  fixedSlots: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    startTime: String,
    endTime: String,
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    isLocked: { type: Boolean, default: true }
  }],
  isCrossDeptFaculty: { type: Boolean, default: false },
  crossDeptFacultySource: String,
  status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date
}, { timestamps: true });

subjectAllocationSchema.index({ semesterId: 1, classId: 1, 'subject.code': 1 }, { unique: true });

module.exports = mongoose.model('SubjectAllocation', subjectAllocationSchema);

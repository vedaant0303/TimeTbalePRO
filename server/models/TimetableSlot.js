const mongoose = require('mongoose');

const timetableSlotSchema = new mongoose.Schema({
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'SemesterConfig', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  slotNumber: { type: Number },
  batch: { type: String, default: null },             // null = theory (all batches)
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  subjectCode: String,
  subjectName: String,
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  facultyName: String,
  facultyShortCode: String,
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  roomName: String,
  slotType: {
    type: String,
    enum: ['theory', 'practical', 'break', 'miniproject', 'majorproject',
           'honours', 'DLOC', 'ILOC', 'mentor', 'library', 'combined', 'OE'],
    default: 'theory'
  },
  isLocked: { type: Boolean, default: false },
  isClasswide: { type: Boolean, default: false },
  // For combined batch practicals (like CC)
  combinedBatches: [String],                           // ["B1","B2"]
  combinedFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  combinedFacultyName: String,
  combinedRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  combinedRoomName: String,
  note: String,
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'published', 'locked'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for fast conflict checks
timetableSlotSchema.index({ semesterId: 1, day: 1, startTime: 1, facultyId: 1 });
timetableSlotSchema.index({ semesterId: 1, day: 1, startTime: 1, roomId: 1 });
timetableSlotSchema.index({ semesterId: 1, classId: 1, day: 1, startTime: 1, batch: 1 });
timetableSlotSchema.index({ semesterId: 1, department: 1 });

module.exports = mongoose.model('TimetableSlot', timetableSlotSchema);

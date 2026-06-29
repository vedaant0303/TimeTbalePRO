const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  roomNumber: { type: String, trim: true },
  building: { type: String, trim: true },
  floor: { type: Number },
  capacity: { type: Number, required: true },
  type: { type: String, enum: ['classroom', 'lab', 'seminar_hall', 'auditorium'], default: 'classroom' },
  facilities: [{ type: String }],
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  isShared: { type: Boolean, default: false },
  sharedWith: [{
    deptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    percentage: { type: Number, default: 50 }
  }],
  unavailableDates: [{
    from: Date,
    to: Date,
    reason: String
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);

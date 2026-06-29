const mongoose = require('mongoose');

const roomAllocationSchema = new mongoose.Schema({
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'SemesterConfig', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  rooms: [{
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    isAccessible: { type: Boolean, default: true },
    sharingPercentage: { type: Number, default: 100, min: 0, max: 100 },
    sharedWithDeptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }
  }],
  batchConfig: [{
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    batchCount: { type: Number, default: 4 },
    batchLabels: { type: [String], default: ['B1', 'B2', 'B3', 'B4'] }
  }],
  classroomSummary: {
    fullClassrooms: { type: Number, default: 0 },
    sharedClassrooms: { type: Number, default: 0 },
    totalEffective: { type: Number, default: 0 },
    totalLabs: { type: Number, default: 0 }
  }
}, { timestamps: true });

roomAllocationSchema.index({ semesterId: 1, departmentId: 1 }, { unique: true });

// Calculate classroom summary
roomAllocationSchema.methods.calculateSummary = async function() {
  const Room = mongoose.model('Room');
  let fullClassrooms = 0;
  let sharedClassrooms = 0;
  let totalLabs = 0;

  for (const ra of this.rooms) {
    if (!ra.isAccessible) continue;
    const room = await Room.findById(ra.roomId);
    if (!room) continue;
    if (room.type === 'classroom') {
      if (ra.sharingPercentage === 100) {
        fullClassrooms++;
      } else {
        sharedClassrooms += ra.sharingPercentage / 100;
      }
    } else if (room.type === 'lab') {
      totalLabs++;
    }
  }

  this.classroomSummary = {
    fullClassrooms,
    sharedClassrooms,
    totalEffective: fullClassrooms + sharedClassrooms,
    totalLabs
  };
};

module.exports = mongoose.model('RoomAllocation', roomAllocationSchema);

const mongoose = require('mongoose');

const facultyWorkloadSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'SemesterConfig', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  allocations: [{
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    className: { type: String, default: '' }, // e.g. 'SE-1', 'TE-2', 'BE'
    semester: { type: Number },              // e.g. 4, 6, 8
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    subjectCode: String,
    subjectName: String,
    theoryLoad: { type: Number, default: 0 },
    practicalLoad: {
      batch1: { type: Number, default: 0 },
      batch2: { type: Number, default: 0 },
      batch3: { type: Number, default: 0 },
      batch4: { type: Number, default: 0 }
    },
    totalLoad: { type: Number, default: 0 },
    extraLoad: { type: Number, default: 0 },
    extraLoadDescription: String
  }],
  miniProjectLoad: { type: Number, default: 0 },
  majorProjectLoad: { type: Number, default: 0 },
  totalTeachingLoad: { type: Number, default: 0 },
  extraTotal: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  remarks: String
}, { timestamps: true });

facultyWorkloadSchema.index({ facultyId: 1, semesterId: 1 }, { unique: true });

// Auto-calculate totals
facultyWorkloadSchema.methods.calculateTotals = function() {
  let total = 0;
  let extra = 0;
  for (const alloc of this.allocations) {
    const pracTotal = (alloc.practicalLoad.batch1 || 0) +
                      (alloc.practicalLoad.batch2 || 0) +
                      (alloc.practicalLoad.batch3 || 0) +
                      (alloc.practicalLoad.batch4 || 0);
    alloc.totalLoad = (alloc.theoryLoad || 0) + pracTotal;
    total += alloc.totalLoad;
    extra += alloc.extraLoad || 0;
  }
  total += (this.miniProjectLoad || 0) + (this.majorProjectLoad || 0);
  this.totalTeachingLoad = total;
  this.extraTotal = extra;
};

module.exports = mongoose.model('FacultyWorkload', facultyWorkloadSchema);

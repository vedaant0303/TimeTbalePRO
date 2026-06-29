const mongoose = require('mongoose');

const GENERATION_STATES = [
  'idle',
  'semester_init',
  'rooms_configured',
  'workload_pending',
  'subject_config_pending',
  'ready_to_generate',
  'generating',
  'draft_generated',
  'pending_approval',
  'approved',
  'rejected',
  'published'
];

const semesterConfigSchema = new mongoose.Schema({
  semester: { type: String, enum: ['odd', 'even'], required: true },
  academicYear: { type: String, required: true },
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  generationState: {
    type: String,
    enum: GENERATION_STATES,
    default: 'idle'
  },
  stateHistory: [{
    state: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String
  }],
  effectiveFrom: Date,
  termStartDate: Date,
  termEndDate: Date,
  yearGroups: [{
    name: { type: String },           // 'FE' or 'SE-TE-BE'
    semesters: [{ type: Number }],     // [1] or [3,5,7] for odd; [2] or [4,6,8] for even
    isSeparateSchedule: { type: Boolean, default: false }  // FE = true (separate TT)
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

semesterConfigSchema.index({ academicYear: 1, semester: 1 }, { unique: true });

// Valid state transitions
const STATE_TRANSITIONS = {
  'idle': ['semester_init'],
  'semester_init': ['rooms_configured', 'idle'],
  'rooms_configured': ['workload_pending', 'idle'],
  'workload_pending': ['subject_config_pending', 'idle'],
  'subject_config_pending': ['ready_to_generate', 'idle'],
  'ready_to_generate': ['generating', 'idle'],
  'generating': ['draft_generated', 'ready_to_generate', 'idle'],
  'draft_generated': ['pending_approval', 'ready_to_generate', 'idle'],
  'pending_approval': ['approved', 'rejected', 'idle'],
  'approved': ['published', 'idle'],
  'rejected': ['draft_generated', 'idle'],
  'published': ['idle']
};

semesterConfigSchema.methods.canTransitionTo = function(newState) {
  const allowed = STATE_TRANSITIONS[this.generationState] || [];
  return allowed.includes(newState);
};

semesterConfigSchema.methods.transitionTo = function(newState, userId, note) {
  if (!this.canTransitionTo(newState)) {
    throw new Error(`Cannot transition from '${this.generationState}' to '${newState}'`);
  }
  this.generationState = newState;
  this.stateHistory.push({
    state: newState,
    changedBy: userId,
    changedAt: new Date(),
    note: note || ''
  });
};

semesterConfigSchema.statics.GENERATION_STATES = GENERATION_STATES;
semesterConfigSchema.statics.STATE_TRANSITIONS = STATE_TRANSITIONS;

module.exports = mongoose.model('SemesterConfig', semesterConfigSchema);

const mongoose = require('mongoose');

const collegeConfigSchema = new mongoose.Schema({
  collegeName: { type: String, required: true, default: 'My College' },
  collegeCode: { type: String, default: '' },
  logo: { type: String, default: '' },
  address: { type: String, default: '' },
  website: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  allowedDomains: [{ type: String }],  // e.g. ['vcet.edu.in']
  academicYearFormat: { type: String, default: 'YYYY-YYYY' },
  isSetupComplete: { type: Boolean, default: false },
  setupCompletedAt: { type: Date },
  setupBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  settings: {
    maxPeriodsPerDay: { type: Number, default: 8 },
    workingDays: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    periodDuration: { type: Number, default: 60 },  // minutes
    breakDuration: { type: Number, default: 15 },
    lunchDuration: { type: Number, default: 45 },
    startTime: { type: String, default: '08:15' },
    batchesPerClass: { type: Number, default: 4 }
  }
}, { timestamps: true });

// Only one config per database
collegeConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      collegeName: 'My College',
      isSetupComplete: false
    });
  }
  return config;
};

module.exports = mongoose.model('CollegeConfig', collegeConfigSchema);

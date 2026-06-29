const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ALLOWED_DOMAINS = ['vcet.edu.in', 'college.edu.in', 'college.edu', 'edu.in'];

const facultySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  shortCode: { type: String, maxlength: 5, trim: true, uppercase: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleVerified: { type: Boolean, default: false },
  role: { type: String, default: 'faculty', immutable: true },
  designation: {
    type: String,
    enum: ['Professor', 'Associate Professor', 'Assistant Professor', 'HOD', 'Adjunct'],
    default: 'Assistant Professor'
  },
  // Supports cross-department assignments
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
  subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  isCrossDept: { type: Boolean, default: false },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  employeeId: { type: String },
  specializations: [{ type: String }],
  maxWeeklyHours: { type: Number, default: 20 },
  maxTheoryHours: { type: Number },
  maxPracticalHours: { type: Number },
  unavailability: [{
    from: Date,
    to: Date,
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }],
  lastLogin: { type: Date }
}, { timestamps: true });

// Validate email domain
facultySchema.pre('validate', function () {
  if (this.email) {
    const domain = this.email.split('@')[1];
    if (!domain || !ALLOWED_DOMAINS.some(d => domain.endsWith(d))) {
      this.invalidate('email', `Only college email addresses are allowed (${ALLOWED_DOMAINS.join(', ')})`);
    }
  }
});

facultySchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

facultySchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

facultySchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

facultySchema.statics.isAllowedDomain = function (email) {
  const domain = email.split('@')[1];
  return domain && ALLOWED_DOMAINS.some(d => domain.endsWith(d));
};

facultySchema.statics.ALLOWED_DOMAINS = ALLOWED_DOMAINS;

module.exports = mongoose.model('Faculty', facultySchema);

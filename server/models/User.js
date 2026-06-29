const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Allowed domains will be checked against CollegeConfig dynamically

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleVerified: { type: Boolean, default: false },
  role: {
    type: String,
    enum: ['principal', 'dean', 'hod', 'coordinator', 'faculty', 'student', 'admin'],
    required: true
  },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  division: { type: String },
  semester: { type: Number },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },  // Admin must approve new users
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  employeeId: { type: String },
  enrollmentId: { type: String },
  specializations: [{ type: String }],
  maxWeeklyHours: { type: Number, default: 20 },
  unavailability: [{
    date: Date,
    slots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' }],
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }],
  lastLogin: { type: Date }
}, { timestamps: true });

// Domain validation moved to registration route only (not model-level)
// This allows admin-created users with any email domain to work

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Static method to check if an email domain is allowed
userSchema.statics.isAllowedDomain = async function (email) {
  const domain = email.split('@')[1];
  const CC = mongoose.model('CollegeConfig');
  const config = await CC.getConfig();
  return domain && config.allowedDomains.some(d => domain.endsWith(d));
};

module.exports = mongoose.model('User', userSchema);

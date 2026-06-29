const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ALLOWED_DOMAINS = ['vcet.edu.in', 'college.edu.in', 'college.edu', 'edu.in'];

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleVerified: { type: Boolean, default: false },
  role: { type: String, default: 'student', immutable: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  division: { type: String },
  semester: { type: Number },
  batch: { type: String, enum: ['B1', 'B2', 'B3', 'B4'] },
  rollNumber: { type: String },
  enrollmentId: { type: String },
  dlocGroup: { type: String },
  ilocGroup: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, { timestamps: true });

// Validate email domain
studentSchema.pre('validate', function () {
  if (this.email) {
    const domain = this.email.split('@')[1];
    if (!domain || !ALLOWED_DOMAINS.some(d => domain.endsWith(d))) {
      this.invalidate('email', `Only college email addresses are allowed (${ALLOWED_DOMAINS.join(', ')})`);
    }
  }
});

studentSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

studentSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

studentSchema.statics.isAllowedDomain = function (email) {
  const domain = email.split('@')[1];
  return domain && ALLOWED_DOMAINS.some(d => domain.endsWith(d));
};

studentSchema.statics.ALLOWED_DOMAINS = ALLOWED_DOMAINS;

module.exports = mongoose.model('Student', studentSchema);

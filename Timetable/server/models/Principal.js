const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ALLOWED_DOMAINS = ['vcet.edu.in', 'college.edu.in', 'college.edu', 'edu.in'];

const principalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleVerified: { type: Boolean, default: false },
  role: { type: String, default: 'principal', immutable: true },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  employeeId: { type: String },
  lastLogin: { type: Date }
}, { timestamps: true });

// Validate email domain
principalSchema.pre('validate', function () {
  if (this.email) {
    const domain = this.email.split('@')[1];
    if (!domain || !ALLOWED_DOMAINS.some(d => domain.endsWith(d))) {
      this.invalidate('email', `Only college email addresses are allowed (${ALLOWED_DOMAINS.join(', ')})`);
    }
  }
});

principalSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

principalSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

principalSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

principalSchema.statics.isAllowedDomain = function (email) {
  const domain = email.split('@')[1];
  return domain && ALLOWED_DOMAINS.some(d => domain.endsWith(d));
};

principalSchema.statics.ALLOWED_DOMAINS = ALLOWED_DOMAINS;

module.exports = mongoose.model('Principal', principalSchema);

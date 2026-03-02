const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin','hod','faculty','student'], required: true },
  phone: { type: String },
  department: { type: String },
  year: { type: Number },
  section: { type: String },
  batch: { type: String },
  passwordResetOtpHash: { type: String },
  passwordResetOtpExpiresAt: { type: Date },
  passwordResetOtpRequestedAt: { type: Date },
  passwordResetOtpFailedAttempts: { type: Number, default: 0 },
  passwordResetOtpLockedUntil: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);

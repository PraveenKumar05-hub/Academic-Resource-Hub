const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  studentName: { type: String },
  studentYear: { type: Number },
  studentSection: { type: String },
  subject: { type: String },
  reminderStage: { type: String },
  reminderDueDate: { type: Date },
  whatsappStatus: {
    type: String,
    enum: ['not_attempted', 'sent', 'failed', 'skipped_no_phone', 'disabled', 'invalid_phone'],
    default: 'not_attempted'
  },
  whatsappError: { type: String },
  whatsappSentAt: { type: Date },
  emailStatus: {
    type: String,
    enum: ['not_attempted', 'sent', 'failed', 'skipped_no_email', 'disabled', 'invalid_email'],
    default: 'not_attempted'
  },
  emailError: { type: String },
  emailSentAt: { type: Date },
  type: { type: String, enum: ['announcement', 'urgent', 'info'], default: 'info' },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
  department: { type: String },
  recipientRole: { type: String, enum: ['student', 'faculty', 'admin', 'all'], default: 'all' },
  recipientYear: { type: Number, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);

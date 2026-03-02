const mongoose = require('mongoose');

const AcknowledgementSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  acknowledgedAt: { type: Date, default: Date.now },
  method: { type: String, enum: ['online','hardcopy'], default: 'online' }
});

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  department: { type: String, required: true },
  year: { type: Number, required: true },
  section: { type: String, required: true },
  subject: String,
  dueDate: Date,
  fileUrl: String,
  filename: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgements: [AcknowledgementSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Assignment', AssignmentSchema);

const mongoose = require('mongoose')

const ActivityLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.Mixed },
  summary: { type: String, required: true },
  department: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('ActivityLog', ActivityLogSchema)
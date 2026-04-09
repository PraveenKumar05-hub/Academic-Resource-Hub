const mongoose = require('mongoose')

const StudentTestResponseSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: String, required: true },
  year: { type: Number, required: true },
  section: { type: String, required: true },
  batch: { type: String, required: true },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'submitted', 'cancelled'],
    default: 'not_started'
  },
  answers: [
    {
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestQuestion' },
      selectedOptions: [{ type: String }],
      isCorrect: { type: Boolean },
      marksAwarded: { type: Number, default: 0 }
    }
  ],
  totalMarks: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  totalAttempted: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  startedAt: { type: Date },
  submittedAt: { type: Date },
  cancellationReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

StudentTestResponseSchema.index({ test: 1, student: 1 }, { unique: true })
StudentTestResponseSchema.index({ student: 1, createdAt: -1 })

module.exports = mongoose.model('StudentTestResponse', StudentTestResponseSchema)

const mongoose = require('mongoose')

const TestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: Number, required: true },
  section: { type: String, required: true },
  batch: { type: String, required: true },
  testDate: { type: Date, required: true },
  maxMarks: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'published', 'cancelled'],
    default: 'scheduled'
  },
  questionsCount: { type: Number, default: 0 },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TestQuestion' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: { type: Date },
  cancelledAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

TestSchema.index({ department: 1, year: 1, section: 1, batch: 1, testDate: -1 })
TestSchema.index({ createdBy: 1, createdAt: -1 })

module.exports = mongoose.model('Test', TestSchema)
const mongoose = require('mongoose')

const TestQuestionSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  questionNumber: { type: Number, required: true },
  questionText: { type: String, required: true },
  questionType: { type: String, enum: ['single', 'multiple'], default: 'single' },
  options: [
    {
      optionId: { type: String, required: true },
      text: { type: String, required: true },
      isCorrect: { type: Boolean, default: false }
    }
  ],
  marks: { type: Number, required: true, min: 1 },
  explanation: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

TestQuestionSchema.index({ test: 1, questionNumber: 1 })

module.exports = mongoose.model('TestQuestion', TestQuestionSchema)

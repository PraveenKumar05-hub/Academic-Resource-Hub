const mongoose = require('mongoose')

const TestMarkSchema = new mongoose.Schema({
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: String, required: true },
  year: { type: Number, required: true },
  section: { type: String, required: true },
  batch: { type: String, required: true },
  marksObtained: { type: Number },
  attendance: {
    type: String,
    enum: ['present', 'absent'],
    default: 'present'
  },
  remarks: { type: String },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

TestMarkSchema.index({ test: 1, student: 1 }, { unique: true })
TestMarkSchema.index({ student: 1, createdAt: -1 })

module.exports = mongoose.model('TestMark', TestMarkSchema)
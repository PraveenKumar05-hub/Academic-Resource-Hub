const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  title: String,
  url: String,
  filename: String,
  subject: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  year: Number,
  section: String,
  createdAt: { type: Date, default: Date.now }
});

const YearSubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  credits: { type: Number, required: true, min: 0 }
}, { _id: false });

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subjects: [String],
  sections: [String],
  yearConfigs: {
    year1: {
      subjects: { type: [YearSubjectSchema], default: [] },
      sections: { type: [String], default: [] }
    },
    year2: {
      subjects: { type: [YearSubjectSchema], default: [] },
      sections: { type: [String], default: [] }
    },
    year3: {
      subjects: { type: [YearSubjectSchema], default: [] },
      sections: { type: [String], default: [] }
    },
    year4: {
      subjects: { type: [YearSubjectSchema], default: [] },
      sections: { type: [String], default: [] }
    }
  },
  materials: [MaterialSchema]
});

module.exports = mongoose.model('Department', DepartmentSchema);

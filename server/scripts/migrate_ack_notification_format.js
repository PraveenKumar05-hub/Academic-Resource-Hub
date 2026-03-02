require('dotenv').config()
const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const Assignment = require('../models/Assignment')

async function run() {
  await mongoose.connect(process.env.MONGO_URI)

  const oldPattern = /^(.+?) \((.+?)\) acknowledged assignment "(.+?)"\.$/
  const currentPattern = /^Name:\s*(.*?),\s*Year:\s*(.*?),\s*Section:\s*(.*?),\s*Subject:\s*(.*)$/i
  const notes = await Notification.find({ title: 'Assignment Acknowledged' })

  let updated = 0
  for (const note of notes) {
    let studentName = note.studentName || '-'
    let studentYear = note.studentYear
    let studentSection = note.studentSection || '-'
    let subject = note.subject || '-'

    const oldMatch = String(note.message || '').match(oldPattern)
    const currentMatch = String(note.message || '').match(currentPattern)

    if (oldMatch) {
      studentName = oldMatch[1] || studentName
      subject = oldMatch[3] || subject
    }

    if (currentMatch) {
      studentName = (currentMatch[1] || '').trim() || studentName
      const parsedYear = (currentMatch[2] || '').trim()
      if (parsedYear && parsedYear !== '-') {
        const numericYear = Number(parsedYear)
        if (Number.isFinite(numericYear)) studentYear = numericYear
      }
      studentSection = (currentMatch[3] || '').trim() || studentSection
      subject = (currentMatch[4] || '').trim() || subject
    }

    if (note.assignment) {
      const assignment = await Assignment.findById(note.assignment).select('year section subject')
      if (assignment) {
        if (!Number.isFinite(Number(studentYear))) {
          studentYear = assignment.year
        }
        if (!studentSection || studentSection === '-') {
          studentSection = assignment.section || '-'
        }
        if (!subject || subject === '-') {
          subject = assignment.subject || '-'
        }
      }
    }

    const finalYear = Number.isFinite(Number(studentYear)) ? Number(studentYear) : undefined
    const finalSection = (studentSection && studentSection !== '-') ? studentSection : '-'
    const finalSubject = (subject && subject !== '-') ? subject : '-'

    note.studentName = studentName
    note.studentYear = finalYear
    note.studentSection = finalSection
    note.subject = finalSubject
    note.message = `Name: ${studentName}, Year: ${finalYear ?? '-'}, Section: ${finalSection}, Subject: ${finalSubject}`
    await note.save()
    updated++
  }

  console.log('ACK_NOTIFICATION_UPDATED', updated)
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  try {
    await mongoose.disconnect()
  } catch (_) {}
  process.exit(1)
})

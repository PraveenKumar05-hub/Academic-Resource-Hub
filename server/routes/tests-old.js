const express = require('express')
const router = express.Router()
const Test = require('../models/Test')
const TestMark = require('../models/TestMark')
const User = require('../models/User')
const { verifyToken, requireRole } = require('../middleware/auth')
const { toCsv } = require('../utils/csv')
const { logActivity } = require('../utils/activityLogger')

function isWebsiteManager(user) {
  return user?.role === 'admin' && !user?.department
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isDepartmentScopedRole(user) {
  return user?.role === 'faculty' || user?.role === 'hod' || (user?.role === 'admin' && !!user?.department)
}

function buildTestsFilter(req) {
  const status = String(req.query?.status || '').trim().toLowerCase()
  const subject = String(req.query?.subject || '').trim()
  const year = Number(req.query?.year || 0)
  const section = String(req.query?.section || '').trim()
  const batch = String(req.query?.batch || '').trim()
  const search = String(req.query?.search || '').trim()

  const query = {}

  if (!isWebsiteManager(req.user)) {
    query.department = new RegExp(`^${escapeRegex(req.user.department)}$`, 'i')
  }

  if (status && ['scheduled', 'completed', 'published'].includes(status)) {
    query.status = status
  }
  if (subject) {
    query.subject = new RegExp(escapeRegex(subject), 'i')
  }
  if (Number.isFinite(year) && year > 0) {
    query.year = year
  }
  if (section) {
    query.section = new RegExp(`^${escapeRegex(section)}$`, 'i')
  }
  if (batch) {
    query.batch = new RegExp(`^${escapeRegex(batch)}$`, 'i')
  }
  if (search) {
    query.$or = [
      { title: new RegExp(escapeRegex(search), 'i') },
      { subject: new RegExp(escapeRegex(search), 'i') },
      { department: new RegExp(escapeRegex(search), 'i') }
    ]
  }

  return query
}

router.post('/', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const {
      title,
      subject,
      department,
      year,
      section,
      batch,
      testDate,
      maxMarks
    } = req.body || {}

    if (!title || !subject || !year || !section || !batch || !testDate || !maxMarks) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const targetDepartment = isWebsiteManager(req.user)
      ? String(department || '').trim()
      : String(req.user.department || '').trim()

    if (!targetDepartment) {
      return res.status(400).json({ message: 'Department is required' })
    }

    if (isDepartmentScopedRole(req.user) && normalizeText(targetDepartment) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot create tests for other departments' })
    }

    const parsedYear = Number(year)
    const parsedMaxMarks = Number(maxMarks)
    if (!Number.isFinite(parsedYear) || parsedYear < 1 || parsedYear > 4) {
      return res.status(400).json({ message: 'Year must be between 1 and 4' })
    }

    if (!Number.isFinite(parsedMaxMarks) || parsedMaxMarks <= 0) {
      return res.status(400).json({ message: 'maxMarks must be greater than 0' })
    }

    const test = await Test.create({
      title: String(title).trim(),
      subject: String(subject).trim(),
      department: targetDepartment,
      year: parsedYear,
      section: String(section).trim().toUpperCase(),
      batch: String(batch).trim(),
      testDate: new Date(testDate),
      maxMarks: parsedMaxMarks,
      status: 'scheduled',
      createdBy: req.user._id,
      updatedAt: new Date()
    })

    await logActivity({
      actor: req.user,
      action: 'test_create',
      entityType: 'test',
      entityId: test._id,
      summary: `Created test ${test.title} for year ${test.year} section ${test.section}`,
      department: test.department,
      metadata: { subject: test.subject, batch: test.batch, testDate: test.testDate }
    })

    return res.status(201).json({ test })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to create test' })
  }
})

router.get('/', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 20)))
    const query = buildTestsFilter(req)

    const total = await Test.countDocuments(query)
    const tests = await Test.find(query)
      .sort({ testDate: -1, createdAt: -1 })
      .populate('createdBy', 'name email role')
      .skip((page - 1) * limit)
      .limit(limit)

    return res.json({ tests, page, limit, total })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch tests' })
  }
})

router.get('/student/tests', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const tests = await Test.find({
      department: new RegExp(`^${escapeRegex(req.user.department)}$`, 'i'),
      year: Number(req.user.year),
      section: new RegExp(`^${escapeRegex(req.user.section)}$`, 'i'),
      batch: new RegExp(`^${escapeRegex(req.user.batch)}$`, 'i')
    })
      .sort({ testDate: -1 })
      .populate('createdBy', 'name email')

    return res.json({ tests })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch student tests' })
  }
})

router.get('/student/marks', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const tests = await Test.find({
      department: new RegExp(`^${escapeRegex(req.user.department)}$`, 'i'),
      year: Number(req.user.year),
      section: new RegExp(`^${escapeRegex(req.user.section)}$`, 'i'),
      batch: new RegExp(`^${escapeRegex(req.user.batch)}$`, 'i'),
      status: 'published'
    }).select('_id title subject maxMarks testDate status')

    const testIds = tests.map((test) => test._id)
    const marks = await TestMark.find({ test: { $in: testIds }, student: req.user._id })
      .populate('test', 'title subject maxMarks testDate status')
      .sort({ createdAt: -1 })

    return res.json({ marks })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch student marks' })
  }
})

router.get('/export/marks', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const query = buildTestsFilter(req)

    const tests = await Test.find(query).sort({ testDate: -1 })
    const testIds = tests.map((test) => test._id)

    const marks = testIds.length
      ? await TestMark.find({ test: { $in: testIds } })
          .populate('student', 'name email year section batch department')
          .populate('test', 'title subject testDate maxMarks status year section batch department')
      : []

    const csv = toCsv(marks, [
      { key: 'studentName', label: 'Student Name', value: (row) => row.student?.name || '-' },
      { key: 'email', label: 'Email', value: (row) => row.student?.email || '-' },
      { key: 'department', label: 'Department', value: (row) => row.test?.department || row.department || '-' },
      { key: 'year', label: 'Year', value: (row) => row.test?.year || row.year || '-' },
      { key: 'section', label: 'Section', value: (row) => row.test?.section || row.section || '-' },
      { key: 'batch', label: 'Batch', value: (row) => row.test?.batch || row.batch || '-' },
      { key: 'title', label: 'Test Title', value: (row) => row.test?.title || '-' },
      { key: 'subject', label: 'Subject', value: (row) => row.test?.subject || '-' },
      { key: 'testDate', label: 'Test Date', value: (row) => row.test?.testDate ? new Date(row.test.testDate).toLocaleDateString() : '-' },
      { key: 'status', label: 'Status', value: (row) => row.test?.status || '-' },
      { key: 'maxMarks', label: 'Max Marks', value: (row) => row.test?.maxMarks || '-' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'marksObtained', label: 'Marks Obtained' },
      { key: 'remarks', label: 'Remarks' }
    ])

    await logActivity({
      actor: req.user,
      action: 'test_marks_export',
      entityType: 'test',
      summary: `Exported combined marks report for ${tests.length} tests`,
      department: req.user.department,
      metadata: { tests: tests.length, marks: marks.length }
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="tests-marks-report.csv"')
    return res.send(csv)
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to export combined marks' })
  }
})

router.get('/report/marks', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 20)))
    const query = buildTestsFilter(req)

    const tests = await Test.find(query).select('_id title subject testDate maxMarks status year section batch department')
    const testIds = tests.map((test) => test._id)

    if (!testIds.length) {
      return res.json({ rows: [], page, limit, total: 0, testsMatched: 0 })
    }

    const marksQuery = { test: { $in: testIds } }
    const total = await TestMark.countDocuments(marksQuery)
    const rows = await TestMark.find(marksQuery)
      .populate('student', 'name email year section batch department')
      .populate('test', 'title subject testDate maxMarks status year section batch department')
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    return res.json({ rows, page, limit, total, testsMatched: tests.length })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch marks report preview' })
  }
})

router.get('/:id/summary', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot access summary for other departments' })
    }

    const totalStudents = await User.countDocuments({
      role: 'student',
      department: new RegExp(`^${escapeRegex(test.department)}$`, 'i'),
      year: test.year,
      section: new RegExp(`^${escapeRegex(test.section)}$`, 'i'),
      batch: new RegExp(`^${escapeRegex(test.batch)}$`, 'i')
    })

    const marks = await TestMark.find({ test: test._id }).select('attendance marksObtained')
    const entered = marks.filter((row) => row.attendance === 'present' && Number.isFinite(Number(row.marksObtained))).length
    const absent = marks.filter((row) => row.attendance === 'absent').length
    const sum = marks.reduce((acc, row) => {
      const value = Number(row.marksObtained)
      if (row.attendance !== 'absent' && Number.isFinite(value)) {
        return acc + value
      }
      return acc
    }, 0)
    const passThreshold = Number(test.maxMarks) * 0.4
    const passCount = marks.filter((row) => row.attendance !== 'absent' && Number(row.marksObtained) >= passThreshold).length
    const failCount = Math.max(0, entered - passCount)

    return res.json({
      test,
      summary: {
        totalStudents,
        marksRecorded: marks.length,
        entered,
        absent,
        passCount,
        failCount,
        average: entered > 0 ? Number((sum / entered).toFixed(2)) : 0,
        passPercentage: entered > 0 ? Number(((passCount / entered) * 100).toFixed(2)) : 0
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch test summary' })
  }
})

router.get('/:id/students', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot access students for other departments' })
    }

    const students = await User.find({
      role: 'student',
      department: new RegExp(`^${escapeRegex(test.department)}$`, 'i'),
      year: test.year,
      section: new RegExp(`^${escapeRegex(test.section)}$`, 'i'),
      batch: new RegExp(`^${escapeRegex(test.batch)}$`, 'i')
    }).select('name email year section batch department')

    return res.json({ test, students })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch test students' })
  }
})

router.post('/:id/marks', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot update marks for other departments' })
    }

    const rows = Array.isArray(req.body?.marks) ? req.body.marks : []
    if (!rows.length) {
      return res.status(400).json({ message: 'marks array is required' })
    }

    const studentIds = rows.map((item) => String(item.studentId || '')).filter(Boolean)
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student',
      department: new RegExp(`^${escapeRegex(test.department)}$`, 'i'),
      year: test.year,
      section: new RegExp(`^${escapeRegex(test.section)}$`, 'i'),
      batch: new RegExp(`^${escapeRegex(test.batch)}$`, 'i')
    }).select('_id name email department year section batch')

    const validStudentSet = new Set(students.map((student) => String(student._id)))
    const results = []

    for (const row of rows) {
      const studentId = String(row.studentId || '')
      if (!validStudentSet.has(studentId)) {
        results.push({ studentId, status: 'failed', reason: 'student not in test target group' })
        continue
      }

      const attendance = String(row.attendance || 'present').toLowerCase()
      if (!['present', 'absent'].includes(attendance)) {
        results.push({ studentId, status: 'failed', reason: 'attendance must be present or absent' })
        continue
      }

      let marksObtained = row.marksObtained
      if (attendance === 'absent') {
        marksObtained = null
      } else {
        marksObtained = Number(marksObtained)
        if (!Number.isFinite(marksObtained) || marksObtained < 0 || marksObtained > Number(test.maxMarks)) {
          results.push({ studentId, status: 'failed', reason: `marks must be between 0 and ${test.maxMarks}` })
          continue
        }
      }

      await TestMark.findOneAndUpdate(
        { test: test._id, student: studentId },
        {
          test: test._id,
          student: studentId,
          department: test.department,
          year: test.year,
          section: test.section,
          batch: test.batch,
          attendance,
          marksObtained,
          remarks: String(row.remarks || '').trim(),
          enteredBy: req.user._id,
          updatedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      results.push({ studentId, status: 'saved' })
    }

    const hasSaved = results.some((result) => result.status === 'saved')
    if (hasSaved && test.status === 'scheduled') {
      test.status = 'completed'
      test.updatedAt = new Date()
      await test.save()
    }

    await logActivity({
      actor: req.user,
      action: 'test_marks_upsert',
      entityType: 'test',
      entityId: test._id,
      summary: `Updated marks for ${results.filter((result) => result.status === 'saved').length} students in ${test.title}`,
      department: test.department,
      metadata: { totalRows: rows.length, saved: results.filter((result) => result.status === 'saved').length }
    })

    return res.json({
      message: 'Marks processed',
      summary: {
        total: rows.length,
        saved: results.filter((result) => result.status === 'saved').length,
        failed: results.filter((result) => result.status === 'failed').length
      },
      results
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update marks' })
  }
})

router.get('/:id/marks', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('createdBy', 'name email')
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot access marks for other departments' })
    }

    const marks = await TestMark.find({ test: test._id })
      .populate('student', 'name email year section batch department')
      .sort({ createdAt: 1 })

    return res.json({ test, marks })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch marks' })
  }
})

router.post('/:id/publish', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot publish tests for other departments' })
    }

    test.status = 'published'
    test.publishedAt = new Date()
    test.updatedAt = new Date()
    await test.save()

    await logActivity({
      actor: req.user,
      action: 'test_publish',
      entityType: 'test',
      entityId: test._id,
      summary: `Published marks for test ${test.title}`,
      department: test.department,
      metadata: { subject: test.subject }
    })

    return res.json({ message: 'Test published successfully', test })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to publish test' })
  }
})

router.get('/:id/marks/export', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot export marks for other departments' })
    }

    const marks = await TestMark.find({ test: test._id })
      .populate('student', 'name email year section batch department')
      .sort({ createdAt: 1 })

    const csv = toCsv(marks, [
      { key: 'studentName', label: 'Student Name', value: (row) => row.student?.name || '-' },
      { key: 'email', label: 'Email', value: (row) => row.student?.email || '-' },
      { key: 'department', label: 'Department', value: () => test.department },
      { key: 'year', label: 'Year', value: () => test.year },
      { key: 'section', label: 'Section', value: () => test.section },
      { key: 'batch', label: 'Batch', value: () => test.batch },
      { key: 'title', label: 'Test Title', value: () => test.title },
      { key: 'subject', label: 'Subject', value: () => test.subject },
      { key: 'testDate', label: 'Test Date', value: () => new Date(test.testDate).toLocaleDateString() },
      { key: 'maxMarks', label: 'Max Marks', value: () => test.maxMarks },
      { key: 'attendance', label: 'Attendance' },
      { key: 'marksObtained', label: 'Marks Obtained' },
      { key: 'remarks', label: 'Remarks' }
    ])

    await logActivity({
      actor: req.user,
      action: 'test_marks_export',
      entityType: 'test',
      entityId: test._id,
      summary: `Exported marks for test ${test.title}`,
      department: test.department,
      metadata: { rows: marks.length }
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="test-${test._id}-marks.csv"`)
    return res.send(csv)
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to export marks' })
  }
})

module.exports = router
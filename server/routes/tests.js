const express = require('express')
const router = express.Router()
const Test = require('../models/Test')
const TestQuestion = require('../models/TestQuestion')
const StudentTestResponse = require('../models/StudentTestResponse')
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

  if (status && ['scheduled', 'completed', 'published', 'cancelled'].includes(status)) {
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

// Create test
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

// Add question to test
router.post('/:id/questions', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot add questions to tests in other departments' })
    }

    if (test.status !== 'scheduled') {
      return res.status(400).json({ message: 'Can only add questions to scheduled tests' })
    }

    const { questionText, questionType, options, marks, explanation } = req.body || {}

    if (!questionText || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'Question text and at least 2 options are required' })
    }

    if (!marks || marks <= 0) {
      return res.status(400).json({ message: 'Marks must be greater than 0' })
    }

    const correctCount = options.filter((opt) => opt.isCorrect).length
    if (correctCount === 0) {
      return res.status(400).json({ message: 'At least one option must be marked as correct' })
    }

    if (questionType === 'single' && correctCount > 1) {
      return res.status(400).json({ message: 'Single choice questions can have only one correct answer' })
    }

    const nextQuestionNumber = (test.questionsCount || 0) + 1

    const question = await TestQuestion.create({
      test: test._id,
      questionNumber: nextQuestionNumber,
      questionText: String(questionText).trim(),
      questionType: questionType || 'single',
      options: options.map((opt, idx) => ({
        optionId: String.fromCharCode(65 + idx),
        text: String(opt.text).trim(),
        isCorrect: Boolean(opt.isCorrect)
      })),
      marks: Number(marks),
      explanation: explanation ? String(explanation).trim() : undefined
    })

    test.questions = test.questions || []
    test.questions.push(question._id)
    test.questionsCount = nextQuestionNumber
    test.maxMarks = (test.maxMarks || 0) + Number(marks)
    test.updatedAt = new Date()
    await test.save()

    return res.status(201).json({ question, test })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to add question' })
  }
})

// Get test details with questions (for taking test)
router.get('/:id/attempt', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('createdBy', 'name email')
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    // Check if student belongs to this test's target group
    if (
      normalizeText(test.department) !== normalizeText(req.user.department) ||
      test.year !== Number(req.user.year) ||
      normalizeText(test.section) !== normalizeText(req.user.section) ||
      normalizeText(test.batch) !== normalizeText(req.user.batch)
    ) {
      return res.status(403).json({ message: 'You are not eligible for this test' })
    }

    if (test.status === 'scheduled') {
      return res.status(400).json({ message: 'Test has not been published yet' })
    }

    if (test.status === 'cancelled') {
      return res.status(400).json({ message: 'This test has been cancelled' })
    }

    // Get or create student response record
    let response = await StudentTestResponse.findOne({ test: test._id, student: req.user._id })
    if (!response) {
      response = await StudentTestResponse.create({
        test: test._id,
        student: req.user._id,
        department: req.user.department,
        year: req.user.year,
        section: req.user.section,
        batch: req.user.batch,
        status: 'not_started'
      })
    }

    // Get questions without showing correct answers
    const questions = await TestQuestion.find({ test: test._id })
      .select('questionNumber questionText questionType options marks')
      .sort({ questionNumber: 1 })

    // Map options without isCorrect flag for students
    const studentQuestions = questions.map((q) => ({
      _id: q._id,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options.map((opt) => ({
        optionId: opt.optionId,
        text: opt.text
      })),
      marks: q.marks
    }))

    // Get student's current answers
    const currentAnswers = {}
    if (response.answers && response.answers.length > 0) {
      response.answers.forEach((ans) => {
        if (ans.questionId) {
          currentAnswers[String(ans.questionId)] = ans.selectedOptions
        }
      })
    }

    return res.json({
      test: {
        _id: test._id,
        title: test.title,
        subject: test.subject,
        testDate: test.testDate,
        questionsCount: test.questionsCount,
        maxMarks: test.maxMarks,
        status: test.status
      },
      questions: studentQuestions,
      response: {
        _id: response._id,
        status: response.status,
        startedAt: response.startedAt,
        submittedAt: response.submittedAt,
        currentAnswers
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load test' })
  }
})

// Start test (mark as in-progress)
router.post('/:id/start', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    let response = await StudentTestResponse.findOne({ test: test._id, student: req.user._id })
    if (!response) {
      return res.status(404).json({ message: 'Test attempt not found' })
    }

    response.status = 'in_progress'
    response.startedAt = new Date()
    await response.save()

    return res.json({ message: 'Test started', response })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to start test' })
  }
})

// Submit test answers
router.post('/:id/submit', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    const { answers } = req.body || {}
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array is required' })
    }

    let response = await StudentTestResponse.findOne({ test: test._id, student: req.user._id })
    if (!response) {
      return res.status(404).json({ message: 'Test attempt not found' })
    }

    if (response.status === 'submitted') {
      return res.status(400).json({ message: 'Test already submitted' })
    }

    if (response.status === 'cancelled') {
      return res.status(400).json({ message: 'Test has been cancelled' })
    }

    // Get all questions for evaluation
    const questions = await TestQuestion.find({ test: test._id })

    let totalMarks = 0
    let totalCorrect = 0
    const evaluatedAnswers = []

    for (const answer of answers) {
      const question = questions.find((q) => String(q._id) === String(answer.questionId))
      if (!question) {
        continue
      }

      const selectedOptions = Array.isArray(answer.selectedOptions) ? answer.selectedOptions : []
      const correctOptions = question.options
        .filter((opt) => opt.isCorrect)
        .map((opt) => opt.optionId)

      const isCorrect =
        selectedOptions.length === correctOptions.length &&
        selectedOptions.every((opt) => correctOptions.includes(opt))

      const marksAwarded = isCorrect ? question.marks : 0
      totalMarks += marksAwarded
      if (isCorrect) totalCorrect += 1

      evaluatedAnswers.push({
        questionId: question._id,
        selectedOptions,
        isCorrect,
        marksAwarded
      })
    }

    response.answers = evaluatedAnswers
    response.totalMarks = totalMarks
    response.totalCorrect = totalCorrect
    response.totalAttempted = answers.length
    response.percentage = test.questionsCount > 0 ? ((totalCorrect / test.questionsCount) * 100).toFixed(2) : 0
    response.status = 'submitted'
    response.submittedAt = new Date()
    response.updatedAt = new Date()
    await response.save()

    return res.json({
      message: 'Test submitted successfully',
      response: {
        _id: response._id,
        totalMarks: response.totalMarks,
        totalCorrect: response.totalCorrect,
        percentage: response.percentage,
        submittedAt: response.submittedAt
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to submit test' })
  }
})

// Get test results (for student or faculty reviewing)
router.get('/:id/results', verifyToken, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate('createdBy', 'name email')
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    let response
    if (req.user.role === 'student') {
      // Students can view their own results only
      response = await StudentTestResponse.findOne({
        test: test._id,
        student: req.user._id
      }).populate('answers.questionId')

      if (!response) {
        return res.status(404).json({ message: 'No test attempt found' })
      }

      // Only allow viewing if test is published
      if (test.status !== 'published') {
        return res.status(403).json({ message: 'Results not available yet' })
      }
    } else if (req.user.role === 'faculty' || req.user.role === 'hod' || req.user.role === 'admin') {
      // Faculty/HOD/Admin can view stats for their department
      if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
        return res.status(403).json({ message: 'Cannot view results for other departments' })
      }

      // Get all responses for this test
      const allResponses = await StudentTestResponse.find({
        test: test._id,
        status: 'submitted'
      })

      const totalResponses = allResponses.length
      const totalMarks = allResponses.reduce((sum, r) => sum + (r.totalMarks || 0), 0)
      const averageMarks = totalResponses > 0 ? (totalMarks / totalResponses).toFixed(2) : 0
      const passCount = allResponses.filter((r) => r.totalMarks >= test.maxMarks * 0.4).length

      return res.json({
        test: {
          _id: test._id,
          title: test.title,
          subject: test.subject,
          maxMarks: test.maxMarks,
          questionsCount: test.questionsCount,
          status: test.status
        },
        stats: {
          totalResponses,
          submittedCount: totalResponses,
          averageMarks,
          passCount,
          failCount: totalResponses - passCount
        }
      })
    }

    // Return individual response for viewing
    return res.json({
      test: {
        _id: test._id,
        title: test.title,
        subject: test.subject,
        maxMarks: test.maxMarks,
        status: test.status
      },
      response: {
        totalMarks: response.totalMarks,
        totalCorrect: response.totalCorrect,
        percentage: response.percentage,
        submittedAt: response.submittedAt
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch results' })
  }
})

// Delete test and cancel for all students
router.delete('/:id', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot delete tests in other departments' })
    }

    // Cancel all student attempts
    const cancellationReason = 'Test was cancelled by course instructor'
    const studentResponses = await StudentTestResponse.updateMany(
      { test: test._id, status: { $ne: 'submitted' } },
      {
        status: 'cancelled',
        cancellationReason
      }
    )

    // Delete all questions
    await TestQuestion.deleteMany({ test: test._id })

    // Delete test
    await Test.findByIdAndDelete(test._id)

    await logActivity({
      actor: req.user,
      action: 'test_delete',
      entityType: 'test',
      entityId: test._id,
      summary: `Deleted test ${test.title} and cancelled ${studentResponses.modifiedCount} student attempts`,
      department: test.department,
      metadata: { title: test.title, studentsCancelled: studentResponses.modifiedCount }
    })

    return res.json({
      message: 'Test deleted successfully',
      summary: {
        testDeleted: true,
        studentAttemptsCancelled: studentResponses.modifiedCount
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete test' })
  }
})

// Get all tests with questions (for management)
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

// Get student available tests
router.get('/student/tests', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const tests = await Test.find({
      department: new RegExp(`^${escapeRegex(req.user.department)}$`, 'i'),
      year: Number(req.user.year),
      section: new RegExp(`^${escapeRegex(req.user.section)}$`, 'i'),
      batch: new RegExp(`^${escapeRegex(req.user.batch)}$`, 'i'),
      status: { $in: ['published', 'cancelled'] }
    })
      .sort({ testDate: -1 })
      .populate('createdBy', 'name email')

    const responses = await StudentTestResponse.find({
      student: req.user._id,
      test: { $in: tests.map((t) => t._id) }
    }).select('test status submittedAt totalMarks')

    const responseMap = new Map(responses.map((r) => [String(r.test), r]))

    const testsWithStatus = tests.map((test) => {
      const resp = responseMap.get(String(test._id))
      return {
        _id: test._id,
        title: test.title,
        subject: test.subject,
        testDate: test.testDate,
        questionsCount: test.questionsCount,
        maxMarks: test.maxMarks,
        status: test.status,
        studentStatus: resp?.status || 'not_started',
        studentMarks: resp?.totalMarks || null
      }
    })

    return res.json({ tests: testsWithStatus })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch student tests' })
  }
})

// Get student published marks
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
    const marks = await StudentTestResponse.find({
      test: { $in: testIds },
      student: req.user._id,
      status: 'submitted'
    }).sort({ createdAt: -1 })

    const result = marks.map((mark) => {
      const test = tests.find((t) => String(t._id) === String(mark.test))
      return {
        _id: mark._id,
        test: test
          ? {
              _id: test._id,
              title: test.title,
              subject: test.subject,
              maxMarks: test.maxMarks,
              testDate: test.testDate
            }
          : null,
        totalMarks: mark.totalMarks,
        percentage: mark.percentage,
        totalCorrect: mark.totalCorrect,
        submittedAt: mark.submittedAt
      }
    })

    return res.json({ marks: result })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch student marks' })
  }
})

// Get test summary (for faculty)
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

    const responses = await StudentTestResponse.find({ test: test._id })
    const submitted = responses.filter((r) => r.status === 'submitted')
    const cancelled = responses.filter((r) => r.status === 'cancelled')

    const passThreshold = test.maxMarks * 0.4
    const passCount = submitted.filter((r) => r.totalMarks >= passThreshold).length

    return res.json({
      test,
      summary: {
        totalStudents,
        totalAttempts: responses.length,
        submitted: submitted.length,
        notStarted: responses.filter((r) => r.status === 'not_started').length,
        inProgress: responses.filter((r) => r.status === 'in_progress').length,
        cancelled: cancelled.length,
        averageMarks: submitted.length > 0 ? (submitted.reduce((sum, r) => sum + r.totalMarks, 0) / submitted.length).toFixed(2) : 0,
        passCount,
        failCount: submitted.length - passCount
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch test summary' })
  }
})

// Get test with questions details (for editing)
router.get('/:id/edit', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot edit tests in other departments' })
    }

    if (test.status !== 'scheduled') {
      return res.status(400).json({ message: 'Can only edit scheduled tests' })
    }

    const questions = await TestQuestion.find({ test: test._id }).sort({ questionNumber: 1 })

    return res.json({ test, questions })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch test details' })
  }
})

// Publish test (make available for students)
router.post('/:id/publish', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const test = await Test.findById(req.params.id)
    if (!test) {
      return res.status(404).json({ message: 'Test not found' })
    }

    if (!isWebsiteManager(req.user) && normalizeText(test.department) !== normalizeText(req.user.department)) {
      return res.status(403).json({ message: 'Cannot publish tests in other departments' })
    }

    if (test.status !== 'scheduled') {
      return res.status(400).json({ message: 'Only scheduled tests can be published' })
    }

    if (!test.questionsCount || test.questionsCount === 0) {
      return res.status(400).json({ message: 'Test must have at least one question' })
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
      summary: `Published test ${test.title} with ${test.questionsCount} questions`,
      department: test.department,
      metadata: { questionsCount: test.questionsCount }
    })

    return res.json({ message: 'Test published successfully', test })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to publish test' })
  }
})

// Export test marks report
router.get('/export/marks', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const query = buildTestsFilter(req)

    const tests = await Test.find(query).sort({ testDate: -1 })
    const testIds = tests.map((test) => test._id)

    const responses = testIds.length
      ? await StudentTestResponse.find({
          test: { $in: testIds },
          status: 'submitted'
        })
          .populate('student', 'name email year section batch department')
          .populate('test', 'title subject testDate maxMarks status year section batch department')
      : []

    const csv = toCsv(responses, [
      { key: 'studentName', label: 'Student Name', value: (row) => row.student?.name || '-' },
      { key: 'email', label: 'Email', value: (row) => row.student?.email || '-' },
      { key: 'department', label: 'Department', value: (row) => row.test?.department || '-' },
      { key: 'year', label: 'Year', value: (row) => row.test?.year || '-' },
      { key: 'section', label: 'Section', value: (row) => row.test?.section || '-' },
      { key: 'batch', label: 'Batch', value: (row) => row.test?.batch || '-' },
      { key: 'title', label: 'Test Title', value: (row) => row.test?.title || '-' },
      { key: 'subject', label: 'Subject', value: (row) => row.test?.subject || '-' },
      { key: 'testDate', label: 'Test Date', value: (row) => row.test?.testDate ? new Date(row.test.testDate).toLocaleDateString() : '-' },
      { key: 'maxMarks', label: 'Max Marks', value: (row) => row.test?.maxMarks || '-' },
      { key: 'totalMarks', label: 'Marks Obtained' },
      { key: 'percentage', label: 'Percentage' },
      { key: 'submittedAt', label: 'Submitted At', value: (row) => row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '-' }
    ])

    await logActivity({
      actor: req.user,
      action: 'test_marks_export',
      entityType: 'test',
      summary: `Exported marks report for ${tests.length} tests`,
      department: req.user.department,
      metadata: { tests: tests.length, responses: responses.length }
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="tests-marks-report.csv"')
    return res.send(csv)
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to export marks' })
  }
})

module.exports = router

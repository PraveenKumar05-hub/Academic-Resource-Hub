import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Pagination,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip
} from '@mui/material'
import QuizIcon from '@mui/icons-material/Quiz'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import PublishIcon from '@mui/icons-material/Publish'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ViewIcon from '@mui/icons-material/Visibility'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function toDateInput(dateValue) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function getStatusColor(status) {
  if (status === 'published') return 'success'
  if (status === 'completed') return 'warning'
  if (status === 'cancelled') return 'error'
  return 'default'
}

export default function Tests() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'
  const canManage = user?.role === 'faculty' || user?.role === 'hod' || user?.role === 'admin'

  const [tests, setTests] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [openCreate, setOpenCreate] = useState(false)
  const [openQuestions, setOpenQuestions] = useState(false)
  const [openTakeTest, setOpenTakeTest] = useState(false)
  const [openResults, setOpenResults] = useState(false)
  const [selectedTest, setSelectedTest] = useState(null)
  const [currentTestData, setCurrentTestData] = useState(null)
  const [studentAnswers, setStudentAnswers] = useState({})
  const [results, setResults] = useState(null)

  const [filterSearch, setFilterSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const limit = 20

  const [form, setForm] = useState({
    title: '',
    subject: '',
    year: 1,
    section: 'A',
    batch: '',
    testDate: '',
    maxMarks: 0
  })

  const [currentQuestion, setCurrentQuestion] = useState({
    questionText: '',
    questionType: 'single',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    marks: 1,
    explanation: ''
  })

  const [questions, setQuestions] = useState([])

  useEffect(() => {
    if (isStudent) {
      loadStudentTests()
    } else {
      loadTests(1)
    }
  }, [])

  async function loadTests(nextPage = page) {
    setLoading(true)
    setError('')
    try {
      const params = {
        search: filterSearch.trim() || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        page: nextPage,
        limit
      }

      const res = await api.get('/tests', { params })
      setTests(res.data?.tests || [])
      setPage(res.data?.page || nextPage)
      setTotal(res.data?.total || 0)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tests')
    } finally {
      setLoading(false)
    }
  }

  async function loadStudentTests() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/tests/student/tests')
      setTests(res.data?.tests || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tests')
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setForm({
      title: '',
      subject: '',
      year: 1,
      section: 'A',
      batch: '',
      testDate: '',
      maxMarks: 0
    })
    setQuestions([])
    setCurrentQuestion({
      questionText: '',
      questionType: 'single',
      options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
      marks: 1,
      explanation: ''
    })
    setOpenCreate(true)
  }

  async function createTest(e) {
    e.preventDefault()
    if (!form.title || !form.subject || !form.batch || !form.testDate) {
      setError('Please fill all required fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/tests', {
        ...form,
        year: Number(form.year),
        maxMarks: questions.reduce((sum, q) => sum + q.marks, 0)
      })

      const testId = res.data.test._id

      // Add all questions
      for (const question of questions) {
        await api.post(`/tests/${testId}/questions`, question)
      }

      setSuccess('Test created successfully with ' + questions.length + ' questions')
      setOpenCreate(false)
      setOpenQuestions(false)
      await loadTests(1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create test')
    } finally {
      setSubmitting(false)
    }
  }

  function addQuestion() {
    if (!currentQuestion.questionText || currentQuestion.options.filter((o) => o.text).length < 2) {
      setError('Question text and at least 2 options are required')
      return
    }

    if (!currentQuestion.options.some((o) => o.isCorrect)) {
      setError('At least one option must be marked as correct')
      return
    }

    setQuestions([...questions, { ...currentQuestion }])
    setCurrentQuestion({
      questionText: '',
      questionType: 'single',
      options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
      marks: 1,
      explanation: ''
    })
    setError('')
    setSuccess(`Question ${questions.length + 1} added`)
  }

  function updateOption(idx, field, value) {
    const updated = [...currentQuestion.options]
    updated[idx] = { ...updated[idx], [field]: value }
    setCurrentQuestion({ ...currentQuestion, options: updated })
  }

  function addOption() {
    setCurrentQuestion({
      ...currentQuestion,
      options: [...currentQuestion.options, { text: '', isCorrect: false }]
    })
  }

  async function openTest(test) {
    setSelectedTest(test)
    setSubmitting(true)
    try {
      const res = await api.get(`/tests/${test._id}/attempt`)
      setCurrentTestData(res.data)
      setStudentAnswers(res.data.response.currentAnswers || {})
      setOpenTakeTest(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load test')
    } finally {
      setSubmitting(false)
    }
  }

  async function startTest() {
    try {
      await api.post(`/tests/${selectedTest._id}/start`)
      setSuccess('Test started')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start test')
    }
  }

  function handleAnswerChange(questionId, options) {
    setStudentAnswers({ ...studentAnswers, [questionId]: options })
  }

  async function submitTest() {
    if (!window.confirm('Submit test? You cannot change answers after submission.')) return

    setSubmitting(true)
    try {
      const answers = Object.entries(studentAnswers).map(([questionId, selectedOptions]) => ({
        questionId,
        selectedOptions: Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions]
      }))

      const res = await api.post(`/tests/${selectedTest._id}/submit`, { answers })
      setSuccess('Test submitted successfully!')
      setOpenTakeTest(false)
      setResults(res.data.response)
      setOpenResults(true)
      await loadStudentTests()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit test')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTest(testId) {
    if (!window.confirm('Delete this test? All student attempts will be cancelled.')) return

    try {
      await api.delete(`/tests/${testId}`)
      setSuccess('Test deleted and all student attempts cancelled')
      await loadTests(1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete test')
    }
  }

  async function publishTest(testId) {
    if (!window.confirm('Publish this test? Students will be able to access it.')) return

    try {
      await api.post(`/tests/${testId}/publish`)
      setSuccess('Test published successfully')
      await loadTests(1)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish test')
    }
  }

  async function viewResults(test) {
    try {
      const res = await api.get(`/tests/${test._id}/results`)
      setResults(res.data.response || res.data.stats)
      setSelectedTest(test)
      setOpenResults(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load results')
    }
  }

  const publishedCount = useMemo(() => tests.filter((item) => item.status === 'published').length, [tests])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QuizIcon sx={{ color: '\''67eea'\'  }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Tests & Assessments</Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Create Test
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {!isStudent && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Title or subject"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3} sx={{ display: 'flex', gap: 1 }}>
                <Button fullWidth variant="contained" onClick={() => loadTests(1)}>Apply</Button>
                <Button fullWidth variant="outlined" onClick={() => { setFilterSearch(''); setFilterStatus('all'); loadTests(1); }}>Reset</Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent><Typography variant="h6">Total Tests</Typography><Typography variant="h4">{tests.length}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent><Typography variant="h6">Published</Typography><Typography variant="h4">{publishedCount}</Typography></CardContent></Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : tests.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}><Typography>No tests found</Typography></Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '\''f5f5f5'\'  }}>
                <TableCell>Title</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Questions</TableCell>
                <TableCell>Max Marks</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tests.map((test) => (
                <TableRow key={test._id}>
                  <TableCell>{test.title}</TableCell>
                  <TableCell>{test.subject}</TableCell>
                  <TableCell>{`Y${test.year} - ${test.section} - ${test.batch}`}</TableCell>
                  <TableCell>{test.questionsCount || 0}</TableCell>
                  <TableCell>{test.maxMarks}</TableCell>
                  <TableCell><Chip size="small" color={getStatusColor(test.status)} label={test.status} /></TableCell>
                  <TableCell align="center">
                    {isStudent ? (
                      <>
                        {test.status === '\''published'\'' && test.studentStatus !== '\''submitted'\'' && (
                          <Tooltip title="Take Test">
                            <IconButton size="small" color="primary" onClick={() => openTest(test)}>
                              <PlayArrowIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {test.studentStatus === '\''submitted'\'' && (
                          <Tooltip title="View Results">
                            <IconButton size="small" color="success" onClick={() => viewResults(test)}>
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <>
                        <Tooltip title="View Summary">
                          <Button size="small" onClick={() => viewResults(test)}>Summary</Button>
                        </Tooltip>
                        {test.status === '\''scheduled'\'' && (
                          <>
                            <Tooltip title="Publish Test">
                              <IconButton size="small" color="success" onClick={() => publishTest(test._id)}>
                                <PublishIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Test">
                              <IconButton size="small" color="error" onClick={() => deleteTest(test._id)}>
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!isStudent && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_e, v) => loadTests(v)} />
        </Box>
      )}

      {/* Create Test Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Test</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth margin="normal" label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth margin="normal" label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField fullWidth margin="normal" select label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
              {[1, 2, 3, 4].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField></Grid>
            <Grid item xs={6}><TextField fullWidth margin="normal" label="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Grid>
          </Grid>
          <TextField fullWidth margin="normal" label="Batch" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="e.g. 2023-2027" />
          <TextField fullWidth margin="normal" type="date" label="Test Date" InputLabelProps={{ shrink: true }} value={toDateInput(form.testDate)} onChange={(e) => setForm({ ...form, testDate: e.target.value })} />

          <Box sx={{ mt: 2, p: 2, backgroundColor: '\''f5f5f5'\'  , borderRadius: 1 }}>
            <Typography variant="h6">Add Questions</Typography>
            <TextField fullWidth margin="normal" label="Question Text" value={currentQuestion.questionText} onChange={(e) => setCurrentQuestion({ ...currentQuestion, questionText: e.target.value })} placeholder="Enter question..." multiline minRows={2} />

            <FormControl fullWidth margin="normal">
              <InputLabel>Question Type</InputLabel>
              <Select value={currentQuestion.questionType} label="Question Type" onChange={(e) => setCurrentQuestion({ ...currentQuestion, questionType: e.target.value })}>
                <MenuItem value="single">Single Choice</MenuItem>
                <MenuItem value="multiple">Multiple Choice</MenuItem>
              </Select>
            </FormControl>

            <TextField fullWidth margin="normal" type="number" label="Marks" value={currentQuestion.marks} onChange={(e) => setCurrentQuestion({ ...currentQuestion, marks: Number(e.target.value) })} inputProps={{ min: 1 }} />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Options:</Typography>
            {currentQuestion.options.map((opt, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Option ${String.fromCharCode(65 + idx)}`}
                  value={opt.text}
                  onChange={(e) => updateOption(idx, '\''text'\'  , e.target.value)}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={opt.isCorrect}
                      onChange={(e) => updateOption(idx, '\''isCorrect'\'  , e.target.checked)}
                    />
                  }
                  label="Correct"
                />
              </Box>
            ))}
            <Button size="small" onClick={addOption} sx={{ mt: 1 }}>+ Add Option</Button>

            <TextField fullWidth margin="normal" label="Explanation (Optional)" value={currentQuestion.explanation} onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })} multiline minRows={2} />

            <Button variant="contained" fullWidth onClick={addQuestion} sx={{ mt: 2 }}>
              Add Question ({questions.length}/10)
            </Button>
          </Box>

          {questions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Questions Added: {questions.length}</Typography>
              {questions.map((q, idx) => (
                <Box key={idx} sx={{ p: 1, mb: 1, backgroundColor: '\''eee'\'  , borderRadius: 1 }}>
                  <Typography variant="body2">{idx + 1}. {q.questionText.substring(0, 50)}... ({q.marks} marks)</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={createTest} disabled={submitting || questions.length === 0}>
            {submitting ? <CircularProgress size={20} /> : '\''Create Test'\''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Take Test Dialog */}
      <Dialog open={openTakeTest} onClose={() => setOpenTakeTest(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedTest?.title}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {submitting ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : currentTestData ? (
            <Box>
              {currentTestData.questions.map((question, idx) => (
                <Card key={question._id} sx={{ mb: 2, p: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Q{question.questionNumber}. {question.questionText} ({question.marks} marks)
                  </Typography>
                  {question.questionType === '\''single'\'' ? (
                    <RadioGroup
                      value={studentAnswers[question._id]?.[0] || '\'''\'' }
                      onChange={(e) => handleAnswerChange(question._id, [e.target.value])}
                    >
                      {question.options.map((opt) => (
                        <FormControlLabel
                          key={opt.optionId}
                          value={opt.optionId}
                          control={<Radio />}
                          label={`${opt.optionId}. ${opt.text}`}
                        />
                      ))}
                    </RadioGroup>
                  ) : (
                    <Box>
                      {question.options.map((opt) => (
                        <FormControlLabel
                          key={opt.optionId}
                          control={
                            <Checkbox
                              checked={(studentAnswers[question._id] || []).includes(opt.optionId)}
                              onChange={(e) => {
                                const selected = studentAnswers[question._id] || []
                                if (e.target.checked) {
                                  handleAnswerChange(question._id, [...selected, opt.optionId])
                                } else {
                                  handleAnswerChange(question._id, selected.filter((s) => s !== opt.optionId))
                                }
                              }}
                            />
                          }
                          label={`${opt.optionId}. ${opt.text}`}
                        />
                      ))}
                    </Box>
                  )}
                </Card>
              ))}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTakeTest(false)}>Back</Button>
          <Button variant="contained" color="success" onClick={submitTest} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : '\''Submit Test'\''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={openResults} onClose={() => setOpenResults(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Results</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {results && (
            <Grid container spacing={2}>
              {isStudent ? (
                <>
                  <Grid item xs={6}><Chip label={`Marks: ${results.totalMarks}`} color="primary" variant="outlined" /></Grid>
                  <Grid item xs={6}><Chip label={`Percentage: ${results.percentage}%`} color="secondary" variant="outlined" /></Grid>
                  <Grid item xs={6}><Chip label={`Correct: ${results.totalCorrect}`} color="success" variant="outlined" /></Grid>
                  <Grid item xs={6}><Chip label={`Submitted: ${new Date(results.submittedAt).toLocaleDateString()}`} variant="outlined" /></Grid>
                </>
              ) : (
                <>
                  <Grid item xs={6}><Chip label={`Total Students: ${results.totalStudents || results.totalResponses || 0}`} color="default" variant="outlined" /></Grid>
                  <Grid item xs={6}><Chip label={`Submitted: ${results.submitted || results.submittedCount || 0}`} color="primary" variant="outlined" /></Grid>
                  <Grid item xs={6}><Chip label={`Pass: ${results.passCount || 0}`} color="success" variant="outlined" /></Grid>
                  <Grid item xs={6}><Chip label={`Avg Marks: ${results.averageMarks || 0}`} color="info" variant="outlined" /></Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResults(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

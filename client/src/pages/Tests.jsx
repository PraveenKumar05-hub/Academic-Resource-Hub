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
  Pagination
} from '@mui/material'
import QuizIcon from '@mui/icons-material/Quiz'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import PublishIcon from '@mui/icons-material/Publish'
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
  return 'default'
}

export default function Tests() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'
  const canManage = user?.role === 'faculty' || user?.role === 'hod' || user?.role === 'admin'

  const [tests, setTests] = useState([])
  const [myMarks, setMyMarks] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [openCreate, setOpenCreate] = useState(false)
  const [openMarks, setOpenMarks] = useState(false)
  const [openSummary, setOpenSummary] = useState(false)
  const [selectedTest, setSelectedTest] = useState(null)
  const [marksRows, setMarksRows] = useState([])
  const [summaryData, setSummaryData] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterYear, setFilterYear] = useState('all')
  const [filterSection, setFilterSection] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const limit = 20
  const reportLimit = 20
  const [reportRows, setReportRows] = useState([])
  const [reportPage, setReportPage] = useState(1)
  const [reportTotal, setReportTotal] = useState(0)
  const [reportLoading, setReportLoading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    subject: '',
    year: 1,
    section: 'A',
    batch: '',
    testDate: '',
    maxMarks: 100
  })

  useEffect(() => {
    loadData()
    if (!isStudent) {
      loadReportPreview(1)
    }
  }, [])

  async function loadData(filters = null, nextPage = page) {
    setLoading(true)
    setError('')
    try {
      if (isStudent) {
        const [testsRes, marksRes] = await Promise.all([
          api.get('/tests/student/tests'),
          api.get('/tests/student/marks')
        ])
        setTests(testsRes.data?.tests || [])
        setMyMarks(marksRes.data?.marks || [])
      } else {
        const resolvedFilters = filters || {
          search: filterSearch,
          status: filterStatus,
          subject: filterSubject,
          year: filterYear,
          section: filterSection,
          batch: filterBatch
        }

        const params = {
          search: String(resolvedFilters.search || '').trim() || undefined,
          status: resolvedFilters.status !== 'all' ? resolvedFilters.status : undefined,
          subject: String(resolvedFilters.subject || '').trim() || undefined,
          year: resolvedFilters.year !== 'all' ? Number(resolvedFilters.year) : undefined,
          section: String(resolvedFilters.section || '').trim() || undefined,
          batch: String(resolvedFilters.batch || '').trim() || undefined,
          page: nextPage,
          limit
        }

        const testsRes = await api.get('/tests', { params })
        setTests(testsRes.data?.tests || [])
        setPage(testsRes.data?.page || nextPage)
        setTotal(testsRes.data?.total || 0)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tests')
    } finally {
      setLoading(false)
    }
  }

  async function createTest(e) {
    e.preventDefault()
    if (!form.title || !form.subject || !form.batch || !form.testDate || !form.maxMarks) {
      setError('Please fill all required fields')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/tests', {
        ...form,
        year: Number(form.year),
        maxMarks: Number(form.maxMarks)
      })
      setSuccess('Test scheduled successfully')
      setOpenCreate(false)
      setForm({ title: '', subject: '', year: 1, section: 'A', batch: '', testDate: '', maxMarks: 100 })
      await loadData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule test')
    } finally {
      setSubmitting(false)
    }
  }

  async function openMarksDialog(test) {
    setSelectedTest(test)
    setOpenMarks(true)
    setSubmitting(true)
    try {
      const [studentsRes, marksRes] = await Promise.all([
        api.get(`/tests/${test._id}/students`),
        api.get(`/tests/${test._id}/marks`)
      ])

      const students = studentsRes.data?.students || []
      const marks = marksRes.data?.marks || []
      const markMap = new Map(marks.map((item) => [String(item.student?._id || item.student), item]))

      setMarksRows(
        students.map((student) => {
          const existing = markMap.get(String(student._id))
          return {
            studentId: student._id,
            name: student.name,
            email: student.email,
            attendance: existing?.attendance || 'present',
            marksObtained: existing?.marksObtained ?? '',
            remarks: existing?.remarks || ''
          }
        })
      )
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load marks sheet')
    } finally {
      setSubmitting(false)
    }
  }

  function updateMarkRow(studentId, patch) {
    setMarksRows((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row)))
  }

  async function saveMarks() {
    if (!selectedTest) return

    setSubmitting(true)
    try {
      const payload = marksRows.map((row) => ({
        studentId: row.studentId,
        attendance: row.attendance,
        marksObtained: row.attendance === 'absent' ? null : Number(row.marksObtained),
        remarks: row.remarks
      }))

      await api.post(`/tests/${selectedTest._id}/marks`, { marks: payload })
      setSuccess('Marks saved successfully')
      setOpenMarks(false)
      setSelectedTest(null)
      setMarksRows([])
      await loadData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save marks')
    } finally {
      setSubmitting(false)
    }
  }

  async function publishMarks(testId) {
    if (!window.confirm('Publish marks for this test?')) return
    try {
      await api.post(`/tests/${testId}/publish`)
      setSuccess('Marks published successfully')
      await loadData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish marks')
    }
  }

  async function exportMarks(test) {
    try {
      const res = await api.get(`/tests/${test._id}/marks/export`, { responseType: 'blob' })
      downloadBlob(`${test.title.replace(/\s+/g, '-')}-marks.csv`, new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export marks')
    }
  }

  async function exportCombinedMarks() {
    try {
      const params = {
        search: String(filterSearch || '').trim() || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        subject: String(filterSubject || '').trim() || undefined,
        year: filterYear !== 'all' ? Number(filterYear) : undefined,
        section: String(filterSection || '').trim() || undefined,
        batch: String(filterBatch || '').trim() || undefined
      }
      const res = await api.get('/tests/export/marks', { params, responseType: 'blob' })
      downloadBlob('tests-marks-report.csv', new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export combined marks')
    }
  }

  async function loadReportPreview(nextPage = reportPage, filters = null) {
    if (isStudent) return

    setReportLoading(true)
    try {
      const resolvedFilters = filters || {
        search: filterSearch,
        status: filterStatus,
        subject: filterSubject,
        year: filterYear,
        section: filterSection,
        batch: filterBatch
      }

      const params = {
        search: String(resolvedFilters.search || '').trim() || undefined,
        status: resolvedFilters.status !== 'all' ? resolvedFilters.status : undefined,
        subject: String(resolvedFilters.subject || '').trim() || undefined,
        year: resolvedFilters.year !== 'all' ? Number(resolvedFilters.year) : undefined,
        section: String(resolvedFilters.section || '').trim() || undefined,
        batch: String(resolvedFilters.batch || '').trim() || undefined,
        page: nextPage,
        limit: reportLimit
      }

      const res = await api.get('/tests/report/marks', { params })
      setReportRows(res.data?.rows || [])
      setReportPage(res.data?.page || nextPage)
      setReportTotal(res.data?.total || 0)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load marks report preview')
    } finally {
      setReportLoading(false)
    }
  }

  async function openSummaryDialog(test) {
    setSelectedTest(test)
    setOpenSummary(true)
    setSummaryLoading(true)
    try {
      const res = await api.get(`/tests/${test._id}/summary`)
      setSummaryData(res.data?.summary || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load test summary')
      setSummaryData(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  function applyFilters() {
    setPage(1)
    loadData({
      search: filterSearch,
      status: filterStatus,
      subject: filterSubject,
      year: filterYear,
      section: filterSection,
      batch: filterBatch
    }, 1)
    setReportPage(1)
    loadReportPreview(1, {
      search: filterSearch,
      status: filterStatus,
      subject: filterSubject,
      year: filterYear,
      section: filterSection,
      batch: filterBatch
    })
  }

  function resetFilters() {
    setFilterSearch('')
    setFilterStatus('all')
    setFilterSubject('')
    setFilterYear('all')
    setFilterSection('')
    setFilterBatch('')
    setPage(1)
    loadData({ search: '', status: 'all', subject: '', year: 'all', section: '', batch: '' }, 1)
    setReportPage(1)
    loadReportPreview(1, { search: '', status: 'all', subject: '', year: 'all', section: '', batch: '' })
  }

  const publishedCount = useMemo(() => tests.filter((item) => item.status === 'published').length, [tests])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])
  const reportTotalPages = useMemo(() => Math.max(1, Math.ceil(reportTotal / reportLimit)), [reportTotal, reportLimit])

  const marksSummary = useMemo(() => {
    if (!selectedTest || marksRows.length === 0) {
      return { total: 0, entered: 0, absent: 0, passCount: 0, average: 0 }
    }

    const maxMarks = Number(selectedTest.maxMarks || 0)
    const passThreshold = maxMarks * 0.4
    let entered = 0
    let absent = 0
    let passCount = 0
    let totalObtained = 0

    marksRows.forEach((row) => {
      if (row.attendance === 'absent') {
        absent += 1
        return
      }

      const marks = Number(row.marksObtained)
      if (Number.isFinite(marks)) {
        entered += 1
        totalObtained += marks
        if (marks >= passThreshold) {
          passCount += 1
        }
      }
    })

    const average = entered > 0 ? Number((totalObtained / entered).toFixed(2)) : 0
    return {
      total: marksRows.length,
      entered,
      absent,
      passCount,
      average
    }
  }, [marksRows, selectedTest])

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QuizIcon sx={{ color: '#667eea' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Tests</Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenCreate(true)}>
            Schedule Test
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {!isStudent && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Title or subject"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={filterStatus} label="Status" onChange={(e) => setFilterStatus(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth size="small" label="Subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select value={filterYear} label="Year" onChange={(e) => setFilterYear(e.target.value)}>
                    <MenuItem value="all">All</MenuItem>
                    {[1, 2, 3, 4].map((item) => <MenuItem key={item} value={String(item)}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={1.5}>
                <TextField fullWidth size="small" label="Section" value={filterSection} onChange={(e) => setFilterSection(e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField fullWidth size="small" label="Batch" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} placeholder="2023-2027" />
              </Grid>
              <Grid item xs={12} md={12} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="contained" onClick={applyFilters}>Apply Filters</Button>
                <Button variant="outlined" onClick={resetFilters}>Reset</Button>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCombinedMarks}>Export Filtered Marks</Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card><CardContent><Typography variant="h6">Total Tests</Typography><Typography variant="h4">{tests.length}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card><CardContent><Typography variant="h6">Published</Typography><Typography variant="h4">{publishedCount}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card><CardContent><Typography variant="h6">Department</Typography><Typography variant="h4">{user?.department || 'ALL'}</Typography></CardContent></Card>
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
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Date</TableCell>
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
                  <TableCell>{new Date(test.testDate).toLocaleDateString()}</TableCell>
                  <TableCell>{test.maxMarks}</TableCell>
                  <TableCell><Chip size="small" color={getStatusColor(test.status)} label={test.status} /></TableCell>
                  <TableCell align="center">
                    {!isStudent && (
                      <>
                        <Button size="small" onClick={() => openMarksDialog(test)}>Marks</Button>
                        <Button size="small" onClick={() => openSummaryDialog(test)}>Summary</Button>
                        <Button size="small" startIcon={<DownloadIcon />} onClick={() => exportMarks(test)}>Export</Button>
                        {test.status !== 'published' && (
                          <Button size="small" startIcon={<PublishIcon />} onClick={() => publishMarks(test._id)}>Publish</Button>
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
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_event, value) => loadData(null, value)}
          />
        </Box>
      )}

      {!isStudent && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Marks Report Preview</Typography>
          {reportLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          ) : reportRows.length === 0 ? (
            <Paper sx={{ p: 2 }}><Typography>No marks records for selected filters</Typography></Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Test</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Attendance</TableCell>
                    <TableCell>Marks</TableCell>
                    <TableCell>Max</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportRows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>{row.student?.name || '-'}</TableCell>
                      <TableCell>{row.student?.email || '-'}</TableCell>
                      <TableCell>{row.test?.title || '-'}</TableCell>
                      <TableCell>{row.test?.subject || '-'}</TableCell>
                      <TableCell>{`Y${row.test?.year || '-'} - ${row.test?.section || '-'} - ${row.test?.batch || '-'}`}</TableCell>
                      <TableCell>{row.test?.status || '-'}</TableCell>
                      <TableCell>{row.attendance}</TableCell>
                      <TableCell>{row.attendance === 'absent' ? '-' : row.marksObtained}</TableCell>
                      <TableCell>{row.test?.maxMarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {reportTotalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={reportTotalPages}
                page={reportPage}
                onChange={(_event, value) => loadReportPreview(value)}
              />
            </Box>
          )}
        </Box>
      )}

      {isStudent && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>My Published Marks</Typography>
          {myMarks.length === 0 ? (
            <Paper sx={{ p: 2 }}><Typography>No published marks available</Typography></Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Attendance</TableCell>
                    <TableCell>Marks</TableCell>
                    <TableCell>Max</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myMarks.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>{row.test?.title || '-'}</TableCell>
                      <TableCell>{row.test?.subject || '-'}</TableCell>
                      <TableCell>{row.test?.testDate ? new Date(row.test.testDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{row.attendance}</TableCell>
                      <TableCell>{row.attendance === 'absent' ? '-' : row.marksObtained}</TableCell>
                      <TableCell>{row.test?.maxMarks || '-'}</TableCell>
                      <TableCell>{row.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Test</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField fullWidth margin="normal" label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField fullWidth margin="normal" select label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>{[1,2,3,4].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField></Grid>
            <Grid item xs={6}><TextField fullWidth margin="normal" label="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Grid>
          </Grid>
          <TextField fullWidth margin="normal" label="Batch" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="e.g. 2023-2027" />
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField fullWidth margin="normal" type="date" label="Test Date" InputLabelProps={{ shrink: true }} value={toDateInput(form.testDate)} onChange={(e) => setForm({ ...form, testDate: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth margin="normal" type="number" label="Max Marks" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={createTest} disabled={submitting}>{submitting ? <CircularProgress size={20} /> : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openMarks} onClose={() => setOpenMarks(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{`Enter Marks - ${selectedTest?.title || ''}`}</DialogTitle>
        <DialogContent>
          {selectedTest && (
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={2.4}><Chip label={`Students: ${marksSummary.total}`} color="default" variant="outlined" /></Grid>
              <Grid item xs={12} sm={2.4}><Chip label={`Entered: ${marksSummary.entered}`} color="primary" variant="outlined" /></Grid>
              <Grid item xs={12} sm={2.4}><Chip label={`Absent: ${marksSummary.absent}`} color="warning" variant="outlined" /></Grid>
              <Grid item xs={12} sm={2.4}><Chip label={`Pass: ${marksSummary.passCount}`} color="success" variant="outlined" /></Grid>
              <Grid item xs={12} sm={2.4}><Chip label={`Avg: ${marksSummary.average}`} color="info" variant="outlined" /></Grid>
            </Grid>
          )}
          {submitting ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : marksRows.length === 0 ? (
            <Typography>No students found for this test.</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Attendance</TableCell>
                    <TableCell>Marks</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {marksRows.map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={row.attendance}
                            onChange={(e) => updateMarkRow(row.studentId, { attendance: e.target.value })}
                          >
                            <MenuItem value="present">Present</MenuItem>
                            <MenuItem value="absent">Absent</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          disabled={row.attendance === 'absent'}
                          value={row.attendance === 'absent' ? '' : row.marksObtained}
                          onChange={(e) => updateMarkRow(row.studentId, { marksObtained: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={row.remarks}
                          onChange={(e) => updateMarkRow(row.studentId, { remarks: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMarks(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveMarks} disabled={submitting || marksRows.length === 0}>
            Save Marks
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openSummary} onClose={() => setOpenSummary(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{`Test Summary - ${selectedTest?.title || ''}`}</DialogTitle>
        <DialogContent>
          {summaryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : !summaryData ? (
            <Typography>No summary data available.</Typography>
          ) : (
            <Grid container spacing={1} sx={{ mt: 0.5 }}>
              <Grid item xs={6}><Chip label={`Total Students: ${summaryData.totalStudents}`} color="default" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Marks Recorded: ${summaryData.marksRecorded}`} color="primary" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Entered: ${summaryData.entered}`} color="info" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Absent: ${summaryData.absent}`} color="warning" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Pass: ${summaryData.passCount}`} color="success" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Fail: ${summaryData.failCount}`} color="error" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Average: ${summaryData.average}`} color="secondary" variant="outlined" /></Grid>
              <Grid item xs={6}><Chip label={`Pass %: ${summaryData.passPercentage}`} color="success" variant="outlined" /></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSummary(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
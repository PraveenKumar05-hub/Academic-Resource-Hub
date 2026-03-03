import React, { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  CircularProgress,
  Chip,
  Paper,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  MenuItem
} from '@mui/material'
import AssignmentIcon from '@mui/icons-material/Assignment'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DateRangeIcon from '@mui/icons-material/DateRange'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Assignments() {

  const { user } = useAuth()

  const [assignments, setAssignments] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [year, setYear] = useState('')
  const [section, setSection] = useState('')

  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [updatingDueDateId, setUpdatingDueDateId] = useState('')
  const [acknowledgingId, setAcknowledgingId] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [subjectOptions, setSubjectOptions] = useState([])
  const [editDueDateOpen, setEditDueDateOpen] = useState(false)
  const [editDueDateValue, setEditDueDateValue] = useState('')
  const [editingAssignment, setEditingAssignment] = useState(null)
  const [yearConfigs, setYearConfigs] = useState({
    year1: { subjects: [], sections: [] },
    year2: { subjects: [], sections: [] },
    year3: { subjects: [], sections: [] },
    year4: { subjects: [], sections: [] }
  })

  useEffect(() => {
    fetchAssignments(1, subjectFilter)
  }, [subjectFilter])

  useEffect(() => {
    if (user?.department) {
      fetchDepartmentConfig(user.department)
    }
  }, [user?.department])

  useEffect(() => {
    if (openDialog && user?.department) {
      fetchDepartmentConfig(user.department)
    }
  }, [openDialog, user?.department])

  async function fetchDepartmentConfig(departmentName) {
    try {
      const res = await api.get(`/departments/${departmentName}`)
      const configs = res.data?.department?.yearConfigs || {}
      setYearConfigs({
        year1: {
          subjects: (configs?.year1?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year1?.sections || []
        },
        year2: {
          subjects: (configs?.year2?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year2?.sections || []
        },
        year3: {
          subjects: (configs?.year3?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year3?.sections || []
        },
        year4: {
          subjects: (configs?.year4?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year4?.sections || []
        }
      })
    } catch (err) {
      console.error('Failed to fetch department config:', err)
    }
  }

  function getYearKey(yearValue) {
    const numericYear = Number(yearValue)
    if (![1, 2, 3, 4].includes(numericYear)) return null
    return `year${numericYear}`
  }

  const selectedYearKey = getYearKey(year)
  const availableSubjects = selectedYearKey ? (yearConfigs[selectedYearKey]?.subjects || []) : []
  const availableSections = selectedYearKey ? (yearConfigs[selectedYearKey]?.sections || []) : []

  // ================= FETCH ASSIGNMENTS =================
  async function fetchAssignments(currentPage = 1, selectedSubject = subjectFilter) {
    setLoading(true)

    try {
      console.log('Fetching assignments, page:', currentPage, 'limit:', limit)

      const queryParams = {
        page: currentPage,
        limit
      }

      if (selectedSubject && selectedSubject !== 'all') {
        queryParams.subject = selectedSubject
      }
      
      const res = await api.get('/assignments', {
        params: queryParams
      })

      console.log('Assignments response:', res.data)

      // Flexible response handling
      const data = res.data

      setAssignments(data.assignments || data.data || [])
      setTotal(data.total || 0)
      setPage(data.page || currentPage)
      setError('')

      if (selectedSubject === 'all') {
        const options = Array.from(
          new Set(
            (data.assignments || data.data || [])
              .map((item) => String(item.subject || '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b))
        setSubjectOptions(options)
      }

    } catch (err) {
      console.error('Error fetching assignments:', err)
      setError('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  // ================= CREATE ASSIGNMENT =================
  async function createAssignment(e) {
    e.preventDefault()

    if (!title || !subject || !dueDate || !year || !section) {
      setError('Please fill all required fields')
      return
    }

    if (!file) {
      setError('Please upload a file for the assignment')
      return
    }

    setSubmitting(true)

    try {
      console.log('Creating assignment with file:', { title, subject, year, section, department: user?.department, file: file.name })

      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('subject', subject)
      formData.append('dueDate', dueDate)
      formData.append('year', year)
      formData.append('section', section)
      formData.append('department', user?.department || '')
      formData.append('file', file)

      const res = await api.post('/assignments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      console.log('Assignment created:', res.data)

      const summary = res?.data?.immediateAlertSummary
      if (summary) {
        const sentCount = Number(summary?.email?.sent || 0)
        const failedCount = Number(summary?.email?.failed || 0) + Number(summary?.email?.invalid_email || 0)
        const skippedCount = Number(summary?.email?.skipped_no_email || 0)
        const disabledCount = Number(summary?.email?.disabled || 0)
        setSuccess(
          `Assignment created successfully! Immediate email alerts: ${summary.notificationsCreated}/${summary.totalStudentsMatched}, sent: ${sentCount}, failed: ${failedCount}, no email: ${skippedCount}, disabled: ${disabledCount}.`
        )
      } else {
        setSuccess('Assignment created successfully!')
      }

      // Reset form
      setTitle('')
      setDescription('')
      setSubject('')
      setDueDate('')
      setYear('')
      setSection('')
      setFile(null)
      setFileName('')
      setOpenDialog(false)

      // IMPORTANT FIX → Refresh first page
      fetchAssignments(1)

      setTimeout(() => setSuccess(''), 3000)

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to create assignment'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadAssignmentFile(assignment) {
    const token = localStorage.getItem('token')
    if (!token) {
      setError('Please login to download files')
      return
    }

    try {
      const downloadUrl = `http://localhost:5000/api/assignments/${assignment._id}/download?token=${token}`

      // Create temporary link and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      const fallbackNameFromUrl = assignment.fileUrl?.split('/').pop()?.split('?')[0]
      link.download = assignment.filename || fallbackNameFromUrl || assignment.title || 'assignment-file'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()

      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)

      console.log('✓ Download initiated')
    } catch (err) {
      console.error('Download error:', err)
      setError(`Download failed: ${err.message}`)
    }
  }

  async function deleteAssignment(assignment) {
    if (!assignment?._id) return

    const confirmed = window.confirm(`Delete assignment "${assignment.title}"?`)
    if (!confirmed) return

    setDeletingId(assignment._id)

    try {
      await api.delete(`/assignments/${assignment._id}`)
      setSuccess('Assignment deleted successfully!')
      setError('')
      fetchAssignments(page)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to delete assignment'
      )
    } finally {
      setDeletingId('')
    }
  }

  async function acknowledgeAssignment(assignmentId) {
    if (!assignmentId) return

    setAcknowledgingId(assignmentId)
    try {
      await api.post(`/assignments/${assignmentId}/acknowledge`, { method: 'online' })
      setSuccess('Acknowledgement sent to staff successfully!')
      setError('')
      await fetchAssignments(page)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to acknowledge assignment'
      )
    } finally {
      setAcknowledgingId('')
    }
  }

  function openDueDateEditor(assignment) {
    if (!assignment?._id) return
    setEditingAssignment(assignment)
    const formattedDate = assignment?.dueDate
      ? new Date(assignment.dueDate).toISOString().split('T')[0]
      : ''
    setEditDueDateValue(formattedDate)
    setEditDueDateOpen(true)
  }

  async function updateAssignmentDueDate() {
    if (!editingAssignment?._id || !editDueDateValue) {
      setError('Please select a due date')
      return
    }

    setUpdatingDueDateId(editingAssignment._id)
    try {
      const res = await api.put(`/assignments/${editingAssignment._id}/due-date`, {
        dueDate: editDueDateValue
      })

      const sync = res?.data?.syncSummary
      if (sync) {
        setSuccess(
          `Due date updated! Synced ${sync.notificationsSynced}/${sync.totalStudentsMatched} class students by email. Sent: ${sync.email?.sent || 0}, failed: ${(sync.email?.failed || 0) + (sync.email?.invalid_email || 0)}, no email: ${sync.email?.skipped_no_email || 0}, disabled: ${sync.email?.disabled || 0}.`
        )
      } else {
        setSuccess('Due date updated successfully!')
      }

      setError('')
      setEditDueDateOpen(false)
      setEditingAssignment(null)
      setEditDueDateValue('')
      await fetchAssignments(page, subjectFilter)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to update due date'
      )
    } finally {
      setUpdatingDueDateId('')
    }
  }

  return (
    <Box sx={{ p: 3 }}>

      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AssignmentIcon sx={{ fontSize: 32, color: '#667eea' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Assignments
          </Typography>
        </Box>

        {(user?.role === 'faculty' || user?.role === 'admin') && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Create Assignment
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* CREATE DIALOG */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Assignment</DialogTitle>
        <DialogContent>

          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
          />

          <TextField
            select
            fullWidth
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            margin="normal"
            required
            disabled={!selectedYearKey}
          >
            {availableSubjects.length === 0 ? (
              <MenuItem value="" disabled>
                No subjects available for selected year
              </MenuItem>
            ) : (
              availableSubjects.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))
            )}
          </TextField>

          <TextField
            type="date"
            fullWidth
            label="Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            required
          />

          <TextField
            select
            fullWidth
            label="Year"
            value={year}
            onChange={(e) => {
              setYear(e.target.value)
              setSubject('')
              setSection('')
            }}
            margin="normal"
            required
          >
            <MenuItem value="1">1st Year</MenuItem>
            <MenuItem value="2">2nd Year</MenuItem>
            <MenuItem value="3">3rd Year</MenuItem>
            <MenuItem value="4">4th Year</MenuItem>
          </TextField>

          <TextField
            select
            fullWidth
            label="Section"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            margin="normal"
            required
            disabled={!selectedYearKey}
          >
            {availableSections.length === 0 ? (
              <MenuItem value="" disabled>
                No sections available for selected year
              </MenuItem>
            ) : (
              availableSections.map((item) => (
                <MenuItem key={item} value={item}>{item}</MenuItem>
              ))
            )}
          </TextField>

          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={<CloudUploadIcon />}
            sx={{ mt: 2 }}
          >
            {fileName ? `Selected: ${fileName}` : 'Upload File *'}
            <input
              hidden
              type="file"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setFile(e.target.files[0])
                  setFileName(e.target.files[0].name)
                }
              }}
            />
          </Button>

        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={createAssignment}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editDueDateOpen}
        onClose={() => {
          if (updatingDueDateId) return
          setEditDueDateOpen(false)
          setEditingAssignment(null)
          setEditDueDateValue('')
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Edit Assignment Due Date</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
            {editingAssignment?.title || 'Assignment'}
          </Typography>
          <TextField
            type="date"
            fullWidth
            label="Due Date"
            value={editDueDateValue}
            onChange={(e) => setEditDueDateValue(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditDueDateOpen(false)
              setEditingAssignment(null)
              setEditDueDateValue('')
            }}
            disabled={Boolean(updatingDueDateId)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={updateAssignmentDueDate}
            disabled={Boolean(updatingDueDateId)}
          >
            {updatingDueDateId ? 'Updating...' : 'Update Due Date'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ASSIGNMENT LIST */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <TextField
          select
          size="small"
          label="Filter by Subject"
          value={subjectFilter}
          onChange={(e) => {
            setPage(1)
            setSubjectFilter(e.target.value)
          }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="all">All Subjects</MenuItem>
          {subjectOptions.map((subjectName) => (
            <MenuItem key={subjectName} value={subjectName}>{subjectName}</MenuItem>
          ))}
        </TextField>
      </Box>

      {subjectFilter !== 'all' && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltIcon />}
            onClick={() => {
              setPage(1)
              setSubjectFilter('all')
            }}
          >
            Subject: {subjectFilter} (Clear)
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : assignments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AssignmentIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
          <Typography>No assignments yet</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {assignments.map((a) => {
            const acknowledged =
              user?.role === 'student' &&
              Array.isArray(a.acknowledgements) &&
              a.acknowledgements.some((ack) => {
                const studentId = typeof ack.student === 'object' ? ack.student?._id : ack.student
                return String(studentId) === String(user?._id)
              })

            return (
            <Grid item xs={12} key={a._id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">{a.title}</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {a.description || 'No description provided'}
                  </Typography>

                  <Chip label={`Subject: ${a.subject || 'N/A'}`} sx={{ mr: 1 }} />
                  <Chip label={`Year: ${a.year}`} sx={{ mr: 1 }} />
                  <Chip label={`Section: ${a.section}`} sx={{ mr: 1 }} />

                  {a.dueDate && (
                    <Chip
                      icon={<DateRangeIcon />}
                      label={`Due: ${new Date(a.dueDate).toLocaleDateString()}`}
                    />
                  )}

                  {a.dueDateUpdatedAt && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      Due date last updated on {new Date(a.dueDateUpdatedAt).toLocaleString()}
                      {a?.dueDateUpdatedBy?.name ? ` by ${a.dueDateUpdatedBy.name}` : ''}
                    </Typography>
                  )}

                  <Box sx={{ mt: 2 }}>
                    {a.fileUrl ? (
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => downloadAssignmentFile(a)}
                        variant="contained"
                        color="success"
                      >
                        Download Attachment
                      </Button>
                    ) : (
                      <Typography variant="caption" sx={{ color: '#999' }}>
                        No file attached
                      </Typography>
                    )}

                    {(user?.role === 'faculty' || user?.role === 'admin') && (
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openDueDateEditor(a)}
                        variant="outlined"
                        sx={{ ml: 1 }}
                      >
                        Edit Due Date
                      </Button>
                    )}

                    {(user?.role === 'faculty' || user?.role === 'admin') && (
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => deleteAssignment(a)}
                        variant="outlined"
                        color="error"
                        disabled={deletingId === a._id}
                        sx={{ ml: 1 }}
                      >
                        {deletingId === a._id ? 'Deleting...' : 'Delete'}
                      </Button>
                    )}

                    {user?.role === 'student' && (
                      <Button
                        size="small"
                        startIcon={<TaskAltIcon />}
                        onClick={() => acknowledgeAssignment(a._id)}
                        variant={acknowledged ? 'outlined' : 'contained'}
                        color={acknowledged ? 'success' : 'primary'}
                        disabled={acknowledged || acknowledgingId === a._id}
                        sx={{ ml: 1 }}
                      >
                        {acknowledged
                          ? 'Acknowledged'
                          : acknowledgingId === a._id
                            ? 'Sending...'
                            : 'Acknowledge'}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            )
          })}
        </Grid>
      )}

      {total > limit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            onChange={(e, value) => {
              setPage(value)
              fetchAssignments(value, subjectFilter)
            }}
          />
        </Box>
      )}
    </Box>
  )
}

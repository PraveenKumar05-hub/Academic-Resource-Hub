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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import SendIcon from '@mui/icons-material/Send'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import ListAltIcon from '@mui/icons-material/ListAlt'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [openEmailDialog, setOpenEmailDialog] = useState(false)
  const [openReminderLogsDialog, setOpenReminderLogsDialog] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [recipientRole, setRecipientRole] = useState('student')
  const [recipientYear, setRecipientYear] = useState('')
  const [notificationType, setNotificationType] = useState('announcement')
  const [students, setStudents] = useState([])
  const [waStudentId, setWaStudentId] = useState('')
  const [waPhone, setWaPhone] = useState('')
  const [waSubject, setWaSubject] = useState('')
  const [waDueDate, setWaDueDate] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waResult, setWaResult] = useState('')
  const [reminderLogs, setReminderLogs] = useState([])
  const [reminderLogsLoading, setReminderLogsLoading] = useState(false)
  const [reminderStatusFilter, setReminderStatusFilter] = useState('all')
  const [reminderPage, setReminderPage] = useState(1)
  const [reminderTotal, setReminderTotal] = useState(0)
  const reminderLimit = 20
  const [deletingReminderId, setDeletingReminderId] = useState('')
  const [deletingAllReminders, setDeletingAllReminders] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.notifications || [])
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  async function createNotification(e) {
    e.preventDefault()
    if (!title || !message) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title,
        message,
        type: notificationType,
        recipientRole,
        department: user.department
      }
      if (recipientRole === 'student' && recipientYear) {
        payload.year = Number(recipientYear)
      }
      const res = await api.post('/notifications', payload)
      setNotifications([res.data.notification, ...notifications])
      setTitle('')
      setMessage('')
      setRecipientRole('student')
      setRecipientYear('')
      setNotificationType('announcement')
      setOpenCreateDialog(false)
      setError('')
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || 'Failed to create notification')
    } finally {
      setSubmitting(false)
    }
  }

  async function openEmailTestDialog() {
    setOpenEmailDialog(true)
    setWaStudentId('')
    setWaPhone('')
    setWaSubject('')
    setWaDueDate('')
    setWaMessage('')
    setWaResult('')
    try {
      const params = { role: 'student' }
      if (user?.role === 'admin' && !user?.department) {
        params.scope = 'all'
      } else if (user?.department) {
        params.department = user.department
      }
      const res = await api.get('/admin/users', { params })
      setStudents(res.data.users || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students for email test')
    }
  }

  async function sendTestEmail(e) {
    e.preventDefault()
    if (!waStudentId && !waPhone.trim()) {
      setError('Please select a student or enter an email address')
      return
    }

    setWaSending(true)
    try {
      const res = await api.post('/notifications/test-email', {
        studentId: waStudentId || undefined,
        email: waPhone.trim() || undefined,
        subject: waSubject,
        dueDate: waDueDate,
        message: waMessage
      })

      setError('')
      const targetEmail = res?.data?.to || waPhone
      setWaResult(`Reminder email sent successfully. Recipient: ${targetEmail}`)
      setNotifications((prev) => prev)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send test reminder email')
      setWaResult('')
    } finally {
      setWaSending(false)
    }
  }

  async function fetchReminderLogs(page = 1, status = reminderStatusFilter) {
    setReminderLogsLoading(true)
    try {
      const res = await api.get('/notifications/reminder-logs', {
        params: {
          page,
          limit: reminderLimit,
          status
        }
      })
      setReminderLogs(res.data.logs || [])
      setReminderPage(res.data.page || page)
      setReminderTotal(res.data.total || 0)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch reminder logs')
    } finally {
      setReminderLogsLoading(false)
    }
  }

  async function openReminderLogs() {
    setOpenReminderLogsDialog(true)
    setReminderStatusFilter('all')
    setReminderPage(1)
    await fetchReminderLogs(1, 'all')
  }

  async function deleteReminderLog(logId) {
    if (!logId) return
    if (!window.confirm('Delete this reminder log?')) return

    setDeletingReminderId(logId)
    try {
      await api.delete(`/notifications/reminder-logs/${logId}`)
      await fetchReminderLogs(reminderPage, reminderStatusFilter)
      setSuccess('Reminder log deleted successfully')
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete reminder log')
    } finally {
      setDeletingReminderId('')
    }
  }

  async function deleteAllReminderLogs() {
    if (!window.confirm('Delete ALL reminder logs? This cannot be undone.')) return

    setDeletingAllReminders(true)
    try {
      const res = await api.delete('/notifications/reminder-logs')
      setReminderLogs([])
      setReminderTotal(0)
      setReminderPage(1)
      setSuccess(`Deleted ${res.data?.deletedCount || 0} reminder logs successfully`)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete all reminder logs')
    } finally {
      setDeletingAllReminders(false)
    }
  }

  async function deleteNotification(id) {
    if (!window.confirm('Delete this notification?')) return
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(notifications.filter(n => n._id !== id))
      setSuccess('Notification deleted successfully')
    } catch (err) {
      setError('Failed to delete notification')
    }
  }

  function parseAckMessage(messageText) {
    const pattern = /Name:\s*(.*?),\s*Year:\s*(.*?),\s*Section:\s*(.*?),\s*Subject:\s*(.*)$/i
    const match = String(messageText || '').match(pattern)
    if (!match) return null
    return {
      name: (match[1] || '').trim(),
      year: (match[2] || '').trim(),
      section: (match[3] || '').trim(),
      subject: (match[4] || '').trim()
    }
  }

  function formatReminderStage(stageValue) {
    const stage = String(stageValue || '').toUpperCase()
    if (stage === 'DUE_TODAY') return 'Due Today'
    if (stage === 'DUE_TOMORROW') return 'Due Tomorrow'
    const match = stage.match(/^DUE_IN_(\d+)_DAYS$/)
    if (match) return `Due in ${match[1]} Days`
    return stage || 'Reminder'
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NotificationsIcon sx={{ fontSize: 32, color: '#667eea' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#333' }}>
            Notifications
          </Typography>
        </Box>
        {(user?.role === 'admin' || user?.role === 'hod' || user?.role === 'faculty') && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ListAltIcon />}
              onClick={openReminderLogs}
              sx={{ textTransform: 'none' }}
            >
              Reminder Logs
            </Button>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={openEmailTestDialog}
              sx={{ textTransform: 'none' }}
            >
              Test Reminder Email
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => setOpenCreateDialog(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: '1rem',
                px: 3,
                py: 1.2,
                borderRadius: 2,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #653a91 100%)',
                  boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)'
                }
              }}
            >
              Send Notification
            </Button>
          </Box>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : notifications.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#f5f5f5' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
          <Typography color="textSecondary">No notifications yet</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {notifications.map((n) => (
            <Grid item xs={12} key={n._id}>
              <Card sx={{
                background: 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)',
                border: '1px solid #e0e0ff',
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                  transform: 'translateY(-2px)'
                }
              }}>
                <CardContent>
                  {(() => {
                    const isAck = n.title === 'Assignment Acknowledged'
                    const parsed = parseAckMessage(n.message)
                    const ackData = isAck
                      ? {
                          name: n.studentName || parsed?.name || '-',
                          year: n.studentYear ?? n.assignment?.year ?? parsed?.year ?? '-',
                          section: n.studentSection || n.assignment?.section || parsed?.section || '-',
                          subject: n.subject || n.assignment?.subject || parsed?.subject || '-'
                        }
                      : null

                    return (
                      <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333', mb: 0.5 }}>
                        {n.title}
                      </Typography>
                      <Chip
                        label={n.type || 'Notification'}
                        size="small"
                        sx={{
                          background: n.type === 'announcement' ? '#e3f2fd' : '#f3e5f5',
                          color: n.type === 'announcement' ? '#1976d2' : '#7b1fa2'
                        }}
                      />
                    </Box>
                    {(user?.role === 'admin' || user?.role === 'hod' || user?.role === 'faculty') && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => deleteNotification(n._id)}
                      >
                        Delete
                      </Button>
                    )}
                  </Box>
                  <Typography sx={{ color: '#555', mt: 1.5, lineHeight: 1.6 }}>
                    {n.message}
                  </Typography>
                  {ackData && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                      <Chip label={`Name: ${ackData.name}`} size="small" variant="outlined" />
                      <Chip label={`Year: ${ackData.year}`} size="small" color="primary" variant="outlined" />
                      <Chip label={`Section: ${ackData.section}`} size="small" color="primary" variant="outlined" />
                      <Chip label={`Subject: ${ackData.subject}`} size="small" variant="outlined" />
                    </Box>
                  )}
                  <Typography sx={{ fontSize: '0.85rem', color: '#999', mt: 1.5 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </Typography>
                      </>
                    )
                  })()}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Notification Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}>
          Send Notification
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
            variant="outlined"
            disabled={submitting}
          />
          <TextField
            fullWidth
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            margin="normal"
            variant="outlined"
            multiline
            rows={4}
            disabled={submitting}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value)}
              label="Type"
              disabled={submitting}
            >
              <MenuItem value="announcement">Announcement</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Send To</InputLabel>
            <Select
              value={recipientRole}
              onChange={(e) => { setRecipientRole(e.target.value); setRecipientYear('') }}
              label="Send To"
              disabled={submitting}
            >
              <MenuItem value="student">Students</MenuItem>
              <MenuItem value="faculty">Faculty</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
          {recipientRole === 'student' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Year (optional)</InputLabel>
              <Select
                value={recipientYear}
                onChange={(e) => setRecipientYear(e.target.value)}
                label="Year (optional)"
                disabled={submitting}
              >
                <MenuItem value=""><em>All Years</em></MenuItem>
                <MenuItem value={1}>1st Year</MenuItem>
                <MenuItem value={2}>2nd Year</MenuItem>
                <MenuItem value={3}>3rd Year</MenuItem>
                <MenuItem value={4}>4th Year</MenuItem>
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateDialog(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={createNotification}
            variant="contained"
            disabled={submitting}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff'
            }}
          >
            {submitting ? <CircularProgress size={20} /> : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEmailDialog} onClose={() => setOpenEmailDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Send Test Reminder Email
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            This sends a reminder using SMTP email.
          </Alert>
          {waResult && (
            <Alert severity="success" sx={{ mb: 1 }}>
              {waResult}
            </Alert>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel>Student</InputLabel>
            <Select
              value={waStudentId}
              onChange={(e) => setWaStudentId(e.target.value)}
              label="Student"
              disabled={waSending}
            >
              <MenuItem value="">
                <em>None (use email below)</em>
              </MenuItem>
              {students.map((student) => (
                <MenuItem key={student._id} value={student._id}>
                  {student.name} ({student.email || 'No email'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Or Email Address"
            value={waPhone}
            onChange={(e) => setWaPhone(e.target.value)}
            margin="normal"
            disabled={waSending}
            placeholder="student@example.com"
            helperText="Optional: send test directly to this email"
          />

          <TextField
            fullWidth
            label="Subject"
            value={waSubject}
            onChange={(e) => setWaSubject(e.target.value)}
            margin="normal"
            disabled={waSending}
          />

          <TextField
            fullWidth
            type="date"
            label="Due Date"
            value={waDueDate}
            onChange={(e) => setWaDueDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            disabled={waSending}
          />

          <TextField
            fullWidth
            label="Custom Message (optional)"
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            margin="normal"
            multiline
            rows={3}
            disabled={waSending}
            placeholder="Leave blank to use default assignment reminder template"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenEmailDialog(false)
              setWaResult('')
            }}
            disabled={waSending}
          >
            Close
          </Button>
          <Button variant="contained" onClick={sendTestEmail} disabled={waSending}>
            {waSending ? <CircularProgress size={20} /> : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openReminderLogsDialog} onClose={() => setOpenReminderLogsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Reminder Delivery Logs</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={reminderStatusFilter}
                label="Status Filter"
                onChange={async (e) => {
                  const value = e.target.value
                  setReminderStatusFilter(value)
                  await fetchReminderLogs(1, value)
                }}
                disabled={reminderLogsLoading}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="sent">Sent only</MenuItem>
                <MenuItem value="failed">Failed only</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={deleteAllReminderLogs}
              disabled={deletingAllReminders || reminderLogsLoading || reminderLogs.length === 0}
            >
              {deletingAllReminders ? 'Deleting...' : 'Delete All'}
            </Button>
          </Box>
          {reminderLogsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : reminderLogs.length === 0 ? (
            <Typography color="text.secondary">No reminder logs found</Typography>
          ) : (
            (() => {
              if (reminderLogs.length === 0) {
                return <Typography color="text.secondary">No reminder logs found for selected filter</Typography>
              }

              return (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Sent At</TableCell>
                    <TableCell>Error</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reminderLogs.map((logItem) => {
                    const studentName = logItem.user?.name || logItem.studentName || '-'
                    const subjectName = logItem.assignment?.subject || logItem.subject || '-'
                    const stageLabel = formatReminderStage(logItem.reminderStage)
                    const emailStatus = logItem.emailStatus || 'not_attempted'

                    return (
                      <TableRow key={logItem._id}>
                        <TableCell>{studentName}</TableCell>
                        <TableCell>{subjectName}</TableCell>
                        <TableCell>{stageLabel}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={emailStatus}
                            color={emailStatus === 'sent' ? 'success' : emailStatus === 'failed' ? 'error' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{logItem.emailSentAt ? new Date(logItem.emailSentAt).toLocaleString() : '-'}</TableCell>
                        <TableCell>{logItem.emailError || '-'}</TableCell>
                        <TableCell>{new Date(logItem.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => deleteReminderLog(logItem._id)}
                            disabled={deletingReminderId === logItem._id || deletingAllReminders}
                          >
                            {deletingReminderId === logItem._id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
              )
            })()
          )}
          {reminderTotal > reminderLimit && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={Math.ceil(reminderTotal / reminderLimit)}
                page={reminderPage}
                onChange={async (_event, value) => {
                  await fetchReminderLogs(value, reminderStatusFilter)
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReminderLogsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

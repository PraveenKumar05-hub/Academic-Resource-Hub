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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox
} from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import * as XLSX from 'xlsx'
import api from '../api'
import { useAuth } from '../context/AuthContext'

function generateCommonBatchOptions() {
  const startYear = 2023
  const totalOptions = 10

  return Array.from({ length: totalOptions }, (_, index) => {
    const admissionYear = startYear + index
    const graduationYear = admissionYear + 4
    return `${admissionYear}-${graduationYear}`
  })
}

export default function ManageUsers() {
  const { user } = useAuth()
  const isDepartmentAdmin = user?.role === 'hod' || (user?.role === 'admin' && !!user?.department)
  const commonBatchOptions = generateCommonBatchOptions()
  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [openBulkDialog, setOpenBulkDialog] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [bulkText, setBulkText] = useState('')
  const [bulkDefaultPassword, setBulkDefaultPassword] = useState('')
  const [bulkPreviewRows, setBulkPreviewRows] = useState([])
  const [bulkPreviewError, setBulkPreviewError] = useState('')
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'student',
    department: '',
    year: 1,
    section: 'A',
    batch: ''
  })

  useEffect(() => {
    fetchList()
  }, [])

  async function fetchList() {
    setLoading(true)
    try {
      const params = user?.role === 'admin' && !user?.department ? { scope: 'all' } : {}
      const res = await api.get('/admin/users', { params })

      // ✅ Handle all backend response formats safely
      const usersData =
        res.data.users ||
        res.data.data ||
        (Array.isArray(res.data) ? res.data : [])

      setUsers(usersData)
      if (!editingId && isDepartmentAdmin && user?.department) {
        setForm(prev => ({ ...prev, department: user.department }))
      }
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setSelectedUserIds(new Set())
    setEditingId(null)
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'student',
      department: user?.department || '',
      year: 1,
      section: 'A',
      batch: ''
    })
    setOpenDialog(true)
  }

  function openEditDialog(user) {
    setSelectedUserIds(new Set())
    setEditingId(user._id)
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      role: user.role,
      department: user.department || '',
      year: user.year || 1,
      section: user.section || 'A',
      batch: user.batch || ''
    })
    setOpenDialog(true)
  }

  async function saveUser(e) {
    e.preventDefault()

    if (!form.name || !form.email) {
      setError('Name and Email are required')
      return
    }

    if (form.role === 'student' && !String(form.batch || '').trim()) {
      setError('Academic batch is required for students')
      return
    }

    setSubmitting(true)

    try {
      if (editingId) {
        const updates = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          department: form.department,
          year: form.year,
          section: form.section,
          batch: form.batch
        }

        if (form.password) {
          updates.password = form.password
        }

        await api.put(`/admin/users/${editingId}`, updates)
        setSuccess('User updated successfully!')
      } else {
        if (!form.password) {
          setError('Password is required for new users')
          setSubmitting(false)
          return
        }

const res = await api.post('/admin/users', form)

// ✅ extract created user safely
const createdUser =
  res.data.user ||
  res.data.data ||
  res.data

// ✅ force UI update
setUsers(prev => [
  ...prev,
  {
    ...createdUser,
    _id: createdUser._id || createdUser.id || Date.now()
  }
])

setSuccess('User created successfully!')

      }

      setOpenDialog(false)
      setEditingId(null)
      setForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'student',
        department: user?.department || '',
        year: 1,
        section: 'A',
        batch: ''
      })

      setError('')

      // ✅ Refresh user list after create/update
      await fetchList()

      setTimeout(() => setSuccess(''), 3000)

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Something went wrong'
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteUser(id) {
    if (!window.confirm('Are you sure you want to delete this user?')) return

    try {
      await api.delete(`/admin/users/${id}`)
      setSuccess('User deleted successfully!')
      await fetchList()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    }
  }

  function handleSelectUser(userId) {
    const newSelected = new Set(selectedUserIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUserIds(newSelected)
  }

  function handleSelectAll() {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set())
    } else {
      const allIds = new Set(filteredUsers.map((u) => u._id))
      setSelectedUserIds(allIds)
    }
  }

  async function deleteSelectedUsers() {
    if (selectedUserIds.size === 0) {
      setError('No users selected')
      return
    }

    const confirmMsg = `Are you sure you want to delete ${selectedUserIds.size} user(s)? This action cannot be undone.`
    if (!window.confirm(confirmMsg)) return

    setSubmitting(true)
    try {
      let deletedCount = 0
      let failedCount = 0

      for (const userId of selectedUserIds) {
        try {
          await api.delete(`/admin/users/${userId}`)
          deletedCount += 1
        } catch (err) {
          console.error(`Failed to delete user ${userId}:`, err)
          failedCount += 1
        }
      }

      setSelectedUserIds(new Set())
      setSuccess(`${deletedCount} user(s) deleted successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}!`)
      await fetchList()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to delete selected users')
    } finally {
      setSubmitting(false)
    }
  }

  function parseCsvLine(line) {
    const out = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      const next = line[i + 1]

      if (ch === '"') {
        if (inQuotes && next === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }

    out.push(current.trim())
    return out
  }

  function parseBulkUsersCsv(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      throw new Error('CSV should include a header and at least one data row')
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
    const requiredHeaders = ['name', 'email', 'role']
    const missing = requiredHeaders.filter((h) => !headers.includes(h))
    if (missing.length) {
      throw new Error(`Missing required header(s): ${missing.join(', ')}`)
    }

    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line)
      const row = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })

      return normalizeBulkRow(row)
    })
  }

  function normalizeBulkRow(row) {
    return {
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role,
      phone: row.phone,
      department: row.department,
      year: row.year ? Number(row.year) : undefined,
      section: row.section,
      batch: row.batch
    }
  }

  function parseBulkUsersExcelRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Excel sheet is empty')
    }

    const normalized = rows.map((raw) => {
      const row = {}
      Object.keys(raw || {}).forEach((key) => {
        row[String(key || '').trim().toLowerCase()] = raw[key]
      })
      return row
    })

    const firstRow = normalized[0] || {}
    const requiredHeaders = ['name', 'email', 'role']
    const missing = requiredHeaders.filter((h) => !(h in firstRow))
    if (missing.length) {
      throw new Error(`Missing required column(s) in Excel: ${missing.join(', ')}`)
    }

    return normalized.map((row) => normalizeBulkRow(row))
  }

  async function handleBulkFileSelect(file) {
    if (!file) return

    const lowerName = String(file.name || '').toLowerCase()

    if (lowerName.endsWith('.csv')) {
      const text = await file.text()
      updateBulkPreview(text)
      return
    }

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames?.[0]
      if (!firstSheetName) {
        throw new Error('Excel file has no sheets')
      }
      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      const parsed = parseBulkUsersExcelRows(rows)
      setBulkPreviewRows(parsed)
      setBulkPreviewError('')
      setBulkText('[Loaded from Excel file]')
      return
    }

    throw new Error('Unsupported file type. Please upload CSV, XLSX, or XLS file.')
  }

  function downloadBulkTemplate() {
    const header = 'name,email,password,role,phone,department,year,section,batch'
    const row1 = 'John Faculty,john.faculty@example.com,Pass@123,faculty,+919876543210,ECE,,,'
    const row2 = 'Asha Student,asha.student@example.com,Pass@123,student,+919800000001,ECE,2,A,2023-2027'
    const csv = `${header}\n${row1}\n${row2}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'bulk-users-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function csvEscape(value) {
    const raw = value == null ? '' : String(value)
    return `"${raw.replace(/"/g, '""')}"`
  }

  function exportCurrentUsersCsv() {
    const rows = filteredUsers.length ? filteredUsers : users
    if (!rows.length) {
      setError('No users available to export')
      return
    }

    const header = ['name', 'email', 'phone', 'role', 'department', 'year', 'section', 'batch']
    const lines = [header.join(',')]

    rows.forEach((u) => {
      lines.push([
        csvEscape(u.name),
        csvEscape(u.email),
        csvEscape(u.phone || ''),
        csvEscape(u.role),
        csvEscape(u.department || ''),
        csvEscape(u.year || ''),
        csvEscape(u.section || ''),
        csvEscape(u.batch || '')
      ].join(','))
    })

    const csv = `${lines.join('\n')}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'users-export.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function updateBulkPreview(text) {
    setBulkText(text)
    setBulkResult(null)

    if (!String(text || '').trim()) {
      setBulkPreviewRows([])
      setBulkPreviewError('')
      return
    }

    try {
      const parsed = parseBulkUsersCsv(text)
      setBulkPreviewRows(parsed)
      setBulkPreviewError('')
    } catch (err) {
      setBulkPreviewRows([])
      setBulkPreviewError(err.message)
    }
  }

  async function handleBulkUpload() {
    setError('')
    setSuccess('')
    setBulkResult(null)

    if (bulkPreviewError) {
      setError(`CSV validation error: ${bulkPreviewError}`)
      return
    }

    let usersToUpload = bulkPreviewRows
    if (!usersToUpload.length) {
      try {
        usersToUpload = parseBulkUsersCsv(bulkText)
      } catch (err) {
        setError(err.message)
        return
      }
    }

    if (!usersToUpload.length) {
      setError('No rows found in CSV')
      return
    }

    setBulkSubmitting(true)
    try {
      const payload = {
        users: usersToUpload,
        defaultPassword: bulkDefaultPassword,
        department: user?.department || ''
      }

      const res = await api.post('/admin/users/bulk', payload)
      const summary = res.data?.summary || {}
      const failedRows = Array.isArray(res.data?.failed) ? res.data.failed : []
      const skippedRows = Array.isArray(res.data?.skipped) ? res.data.skipped : []

      setBulkResult({
        summary,
        failed: failedRows,
        skipped: skippedRows
      })

      setSuccess(`Bulk upload done: Created ${summary.created || 0}, Skipped ${summary.skipped || 0}, Failed ${summary.failed || 0}`)

      if ((summary.failed || 0) === 0 && (summary.skipped || 0) === 0) {
        setOpenBulkDialog(false)
        setBulkText('')
        setBulkDefaultPassword('')
        setBulkPreviewRows([])
        setBulkPreviewError('')
        setBulkResult(null)
      }

      await fetchList()
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Bulk upload failed')
    } finally {
      setBulkSubmitting(false)
    }
  }

  const availableYears = Array.from(
    new Set(
      users
        .filter((user) => user.role === 'student' && user.year)
        .map((user) => Number(user.year))
    )
  ).sort((a, b) => a - b)

  const availableSections = Array.from(
    new Set(
      users
        .filter((user) => user.role === 'student' && user.section)
        .map((user) => String(user.section).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))

  const availableBatches = Array.from(
    new Set(
      users
        .filter((user) => user.role === 'student' && user.batch)
        .map((user) => String(user.batch).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))

  const selectableBatches = Array.from(
    new Set([...commonBatchOptions, ...availableBatches])
  ).sort((a, b) => a.localeCompare(b))

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !search ||
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    const matchesYear =
      yearFilter === 'all' ||
      (user.role === 'student' && String(user.year || '') === yearFilter)

    const matchesSection =
      sectionFilter === 'all' ||
      (user.role === 'student' && String(user.section || '').toLowerCase() === sectionFilter.toLowerCase())

    const matchesBatch =
      batchFilter === 'all' ||
      (user.role === 'student' && String(user.batch || '').toLowerCase() === batchFilter.toLowerCase())

    return matchesSearch && matchesRole && matchesYear && matchesSection && matchesBatch
  })

  function resetFilters() {
    setSearchTerm('')
    setRoleFilter('all')
    setYearFilter('all')
    setSectionFilter('all')
    setBatchFilter('all')
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PeopleIcon sx={{ fontSize: 32, color: '#667eea' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {user?.role === 'admin' ? 'Website User Manager' : `${user?.department || ''} Department Admin (HOD) Dashboard`}
          </Typography>
          {selectedUserIds.size > 0 && (
            <Chip 
              label={`${selectedUserIds.size} selected`} 
              color="primary" 
              variant="outlined"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedUserIds.size > 0 && (
            <Button
              variant="contained"
              color="error"
              onClick={deleteSelectedUsers}
              disabled={submitting}
            >
              Delete Selected ({selectedUserIds.size})
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportCurrentUsersCsv}
          >
            Export Users
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setOpenBulkDialog(true)}
          >
            Bulk Upload
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            Add New User
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search Name / Email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  label="Role"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="faculty">Faculty</MenuItem>
                  <MenuItem value="student">Student</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  label="Year"
                >
                  <MenuItem value="all">All</MenuItem>
                  {availableYears.map((year) => (
                    <MenuItem key={year} value={String(year)}>{`Year ${year}`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Section</InputLabel>
                <Select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  label="Section"
                >
                  <MenuItem value="all">All</MenuItem>
                  {availableSections.map((section) => (
                    <MenuItem key={section} value={section}>{section}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Academic Batch</InputLabel>
                <Select
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  label="Academic Batch"
                >
                  <MenuItem value="all">All</MenuItem>
                  {availableBatches.map((batch) => (
                    <MenuItem key={batch} value={batch}>{batch}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <Button fullWidth variant="outlined" onClick={resetFilters}>
                Reset Filters
              </Button>
            </Grid>

            <Grid item xs={12} md={1}>
              <Chip
                label={filteredUsers.length}
                color="primary"
                size="small"
                sx={{ width: '100%' }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Edit User' : 'Create New User'}
        </DialogTitle>

        <DialogContent>
          <TextField
            fullWidth
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            margin="normal"
            placeholder="e.g. +919876543210"
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            margin="normal"
            required={!editingId}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Role</InputLabel>
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              label="Role"
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="faculty">Faculty</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            margin="normal"
            required
            disabled={isDepartmentAdmin}
          />

          {form.role === 'student' && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Year</InputLabel>
                <Select
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  label="Year"
                >
                  <MenuItem value={1}>1st Year</MenuItem>
                  <MenuItem value={2}>2nd Year</MenuItem>
                  <MenuItem value={3}>3rd Year</MenuItem>
                  <MenuItem value={4}>4th Year</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Section"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                margin="normal"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Academic Batch</InputLabel>
                <Select
                  value={form.batch}
                  onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  label="Academic Batch"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Select Academic Batch</em>
                  </MenuItem>
                  {selectableBatches.map((batch) => (
                    <MenuItem key={batch} value={batch}>{batch}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveUser}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Upload Faculty/Students (CSV or Excel)</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1 }}>
            Required headers: <strong>name,email,role</strong>. Optional: password, phone, department, year, section, batch.
            Students require batch.
          </Alert>

          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={downloadBulkTemplate}>Download CSV Template</Button>
            <Button variant="outlined" component="label">
              Choose CSV / Excel File
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    await handleBulkFileSelect(file)
                  } catch (err) {
                    setBulkPreviewRows([])
                    setBulkPreviewError(err.message)
                  }
                }}
              />
            </Button>
          </Box>

          <TextField
            fullWidth
            margin="normal"
            type="password"
            label="Default Password (optional)"
            value={bulkDefaultPassword}
            onChange={(e) => setBulkDefaultPassword(e.target.value)}
            helperText="Used only when a row has empty password"
          />

          <TextField
            fullWidth
            margin="normal"
            label="CSV Content"
            multiline
            minRows={12}
            value={bulkText}
            onChange={(e) => updateBulkPreview(e.target.value)}
            placeholder="Paste CSV here (or use Choose CSV / Excel File above)"
          />

          {bulkPreviewError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {bulkPreviewError}
            </Alert>
          )}

          {bulkPreviewRows.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Preview (showing {Math.min(10, bulkPreviewRows.length)} of {bulkPreviewRows.length} rows)
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 260 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Year</TableCell>
                      <TableCell>Section</TableCell>
                      <TableCell>Batch</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bulkPreviewRows.slice(0, 10).map((row, idx) => (
                      <TableRow key={`${row.email || 'row'}-${idx}`}>
                        <TableCell>{row.name || '-'}</TableCell>
                        <TableCell>{row.email || '-'}</TableCell>
                        <TableCell>{row.role || '-'}</TableCell>
                        <TableCell>{row.department || '-'}</TableCell>
                        <TableCell>{row.year || '-'}</TableCell>
                        <TableCell>{row.section || '-'}</TableCell>
                        <TableCell>{row.batch || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {bulkResult && (
            <Box sx={{ mt: 2 }}>
              <Alert
                severity={(bulkResult.summary?.failed || 0) > 0 ? 'warning' : 'success'}
                sx={{ mb: 1 }}
              >
                Result: Created {bulkResult.summary?.created || 0}, Skipped {bulkResult.summary?.skipped || 0}, Failed {bulkResult.summary?.failed || 0}
              </Alert>

              {Array.isArray(bulkResult.failed) && bulkResult.failed.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Failed Rows</Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 180 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bulkResult.failed.slice(0, 20).map((item, idx) => (
                          <TableRow key={`failed-${item.row || idx}-${idx}`}>
                            <TableCell>{item.row || '-'}</TableCell>
                            <TableCell>{item.reason || 'Unknown error'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {Array.isArray(bulkResult.skipped) && bulkResult.skipped.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Skipped Rows</Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 160 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bulkResult.skipped.slice(0, 20).map((item, idx) => (
                          <TableRow key={`skipped-${item.row || idx}-${idx}`}>
                            <TableCell>{item.row || '-'}</TableCell>
                            <TableCell>{item.email || '-'}</TableCell>
                            <TableCell>{item.reason || 'Skipped'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenBulkDialog(false)
              setBulkResult(null)
            }}
            disabled={bulkSubmitting}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleBulkUpload} disabled={bulkSubmitting}>
            {bulkSubmitting ? <CircularProgress size={20} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Users Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filteredUsers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>No users found for selected filters</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell padding="checkbox" sx={{ width: 48 }}>
                  <Checkbox
                    indeterminate={selectedUserIds.size > 0 && selectedUserIds.size < filteredUsers.length}
                    checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                    title="Select all users"
                  />
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Details</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow 
                  key={user._id}
                  sx={{ 
                    backgroundColor: selectedUserIds.has(user._id) ? '#e3f2fd' : 'inherit',
                    '&:hover': { backgroundColor: selectedUserIds.has(user._id) ? '#bbdefb' : '#fafafa' }
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedUserIds.has(user._id)}
                      onChange={() => handleSelectUser(user._id)}
                    />
                  </TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || '—'}</TableCell>
                  <TableCell>
                    <Chip label={user.role} size="small" />
                  </TableCell>
                  <TableCell>{user.department || '—'}</TableCell>
                  <TableCell>
                    {user.role === 'student'
                      ? `Year ${user.year || '-'}, Section ${user.section || '-'}, Batch ${user.batch || '-'}`
                      : '—'}
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" onClick={() => openEditDialog(user)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => deleteUser(user._id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}

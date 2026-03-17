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
  InputLabel
} from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
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
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Add New User
        </Button>
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
              <TableRow>
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
                <TableRow key={user._id}>
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

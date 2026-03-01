import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Container
} from '@mui/material'
import DomainAddIcon from '@mui/icons-material/DomainAdd'
import api from '../api'

export default function RegisterDepartmentAdmin() {
  const [departmentName, setDepartmentName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!departmentName || !adminName || !adminEmail || !adminPassword) {
      setError('Please fill all fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/admin/departments/register', {
        departmentName,
        adminName,
        adminEmail,
        adminPassword
      })

      setSuccess(res.data?.message || 'Department and Department Admin (HOD) registered successfully')
      setDepartmentName('')
      setAdminName('')
      setAdminEmail('')
      setAdminPassword('')
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to register department and admin'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <DomainAddIcon sx={{ fontSize: 32, color: '#667eea' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Register Department & Department Admin (HOD)
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Department Name"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Department Admin (HOD) Name"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Department Admin (HOD) Email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Department Admin (HOD) Password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              margin="normal"
              required
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{ mt: 3 }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Register'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

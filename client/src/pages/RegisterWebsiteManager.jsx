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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import api from '../api'

export default function RegisterWebsiteManager() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!name || !email || !password) {
      setError('Please fill all fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/admin/website-managers/register', {
        name,
        email,
        password
      })

      setSuccess(res.data?.message || 'Website manager registered successfully')
      setName('')
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to register website manager'
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
            <AdminPanelSettingsIcon sx={{ fontSize: 32, color: '#667eea' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Register Website Manager
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

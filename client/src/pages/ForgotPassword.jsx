import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  CircularProgress
} from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import axios from 'axios'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email) {
      setError('Please enter your registered email')
      return
    }

    try {
      setLoading(true)

      await axios.post('http://localhost:5000/api/auth/forgot-password/request-otp', {
        email
      })

      navigate('/reset-password', {
        state: {
          email,
          notice: 'OTP sent to your email. Please enter it below to reset your password.'
        }
      })

    } catch (err) {
      const message = err.response?.data?.message || 'Failed to send OTP'

      if (err.response?.status === 429 && message.toLowerCase().includes('please wait')) {
        navigate('/reset-password', {
          state: {
            email,
            notice: `OTP was already sent recently. ${message}`
          }
        })
        return
      }

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={8} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ padding: 4 }}>

            {/* Logo */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <SchoolIcon sx={{ fontSize: 60, color: '#667eea', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#333' }}>
                Forgot Password
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
                Enter your registered email to receive a one-time OTP
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Registered Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                variant="outlined"
                disabled={loading}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  py: 1.5,
                  backgroundColor: '#667eea',
                  fontWeight: 600
                }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
              </Button>
            </form>

            {/* Back to Login */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/login')}
                sx={{ textTransform: 'none', color: '#667eea' }}
              >
                Back to Sign In
              </Button>
            </Box>

          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

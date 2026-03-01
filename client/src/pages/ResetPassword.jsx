import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import axios from 'axios'

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()

  const prefetchedEmail = location.state?.email || ''
  const flowNotice = location.state?.notice || ''

  const [email, setEmail] = useState(prefetchedEmail)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email || !otp || !password || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)

      await axios.post('http://localhost:5000/api/auth/forgot-password/reset', {
        email,
        otp,
        newPassword: password
      })

      setSuccess('Password reset successful! Redirecting to login...')

      setTimeout(() => {
        navigate('/login')
      }, 2000)

    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed')
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
                Reset Password
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
                Create a new password for your account
              </Typography>
            </Box>

            {flowNotice && <Alert severity="info" sx={{ mb: 2 }}>{flowNotice}</Alert>}
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
                disabled={loading}
              />

              <TextField
                fullWidth
                label="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                margin="normal"
                disabled={loading}
                inputProps={{ maxLength: 6 }}
              />

              {/* New Password */}
              <TextField
                fullWidth
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                disabled={loading}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              {/* Confirm Password */}
              <TextField
                fullWidth
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
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
                {loading
                  ? <CircularProgress size={24} color="inherit" />
                  : 'Reset Password'}
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

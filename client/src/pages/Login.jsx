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
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login, loading } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    try {
      const response = await login(email, password)
      const role = response?.user?.role
      const department = response?.user?.department

      if (role === 'admin' && !department) {
        navigate('/website-manager-dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed')
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
        padding: 2,
        overflow: 'auto'
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={8} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ padding: 4 }}>
            
            {/* Logo */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <SchoolIcon sx={{ fontSize: 60, color: '#667eea', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#333' }}>
                Academic Resource Hub
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
                Sign in to access your resources
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                variant="outlined"
                disabled={loading}
              />

              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                variant="outlined"
                disabled={loading}
              />

              {/* Forgot Password Link */}
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    cursor: 'pointer',
                    color: '#667eea',
                    fontWeight: 500,
                    '&:hover': { textDecoration: 'underline' }
                  }}
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot Password?
                </Typography>
              </Box>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, py: 1.5, backgroundColor: '#667eea' }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </form>

          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

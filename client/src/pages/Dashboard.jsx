import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Button,
  CircularProgress,
  Paper
} from '@mui/material'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PersonIcon from '@mui/icons-material/Person'
import api from '../api'
import AdminDashboard from './AdminDashboard'
import FacultyDashboard from './FacultyDashboard'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (user?.role === 'admin' && !user?.department) {
    return <Navigate to="/website-manager-dashboard" replace />
  }

  return (
    <Box>
      {/* Welcome Section */}
      <Paper 
        sx={{ 
          p: 3, 
          mb: 3, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 2
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
          Welcome, {user?.name}! 👋
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon />
              <Typography>
                Role: <strong>{user?.role?.toUpperCase()}</strong>
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentIcon />
              <Typography>
                Department: <strong>{user?.department || 'N/A'}</strong>
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Role-specific Dashboard */}
      {(user?.role === 'hod' || (user?.role === 'admin' && user?.department)) && <AdminDashboard />}
      {user?.role === 'faculty' && <FacultyDashboard />}
      {user?.role === 'student' && (
        <Card sx={{ mb: 3, p: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Quick Links
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={() => navigate('/assignments')}>
                View Assignments
              </Button>
              <Button variant="outlined" onClick={() => navigate('/notifications')}>
                View Schedule
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}

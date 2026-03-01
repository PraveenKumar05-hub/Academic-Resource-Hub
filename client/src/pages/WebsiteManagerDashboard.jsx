import React, { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Container,
  Paper,
  Button
} from '@mui/material'
import PublicIcon from '@mui/icons-material/Public'
import PeopleIcon from '@mui/icons-material/People'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import SchoolIcon from '@mui/icons-material/School'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import NotificationsIcon from '@mui/icons-material/Notifications'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function WebsiteManagerDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    admins: 0,
    hods: 0,
    faculty: 0,
    students: 0,
    departments: 0,
    assignments: 0,
    notifications: 0
  })

  useEffect(() => {
    fetchOverview()
  }, [])

  async function fetchOverview() {
    setLoading(true)
    try {
      const [usersRes, assignmentsRes, notificationsRes] = await Promise.all([
        api.get('/admin/users', { params: { scope: 'all' } }),
        api.get('/assignments', { params: { page: 1, limit: 200 } }),
        api.get('/notifications')
      ])

      const users = usersRes.data?.users || []
      const assignments = assignmentsRes.data?.assignments || []
      const notifications = notificationsRes.data?.notifications || []

      const admins = users.filter((user) => user.role === 'admin' && !user.department).length
      const hods = users.filter((user) => user.role === 'hod' || (user.role === 'admin' && !!user.department)).length
      const faculty = users.filter((user) => user.role === 'faculty').length
      const students = users.filter((user) => user.role === 'student').length
      const departments = new Set(users.map((user) => (user.department || '').trim()).filter(Boolean)).size

      setStats({
        totalUsers: users.length,
        admins,
        hods,
        faculty,
        students,
        departments,
        assignments: assignments.length,
        notifications: notifications.length
      })
    } catch (err) {
      console.error('Website manager dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <Grid item xs={12} sm={6} md={4} lg={3}>
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${color}20, ${color}10)`,
          border: `2px solid ${color}30`
        }}
      >
        <CardContent sx={{ textAlign: 'center' }}>
          <Icon sx={{ fontSize: 42, color, mb: 1 }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            {label}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (user?.role === 'admin' && user?.department) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#fafafa' }}>
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <PublicIcon sx={{ fontSize: 36, color: '#667eea' }} />
          <Typography variant="h3" fontWeight="bold">
            Website Manager Dashboard
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <StatCard icon={PeopleIcon} label="Total Users" value={stats.totalUsers} color="#667eea" />
          <StatCard icon={AdminPanelSettingsIcon} label="Website Managers" value={stats.admins} color="#8e44ad" />
          <StatCard icon={AdminPanelSettingsIcon} label="Department Admins (HOD)" value={stats.hods} color="#6c5ce7" />
          <StatCard icon={SchoolIcon} label="Faculty" value={stats.faculty} color="#16a085" />
          <StatCard icon={MenuBookIcon} label="Students" value={stats.students} color="#2980b9" />
          <StatCard icon={PublicIcon} label="Departments" value={stats.departments} color="#f39c12" />
          <StatCard icon={MenuBookIcon} label="Assignments" value={stats.assignments} color="#e74c3c" />
          <StatCard icon={NotificationsIcon} label="Notifications" value={stats.notifications} color="#27ae60" />
        </Grid>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            Website Manager Actions
          </Typography>
          <Button component={Link} to="/website-manager" variant="contained" sx={{ mr: 2, mb: 1 }}>
            Manage All Users
          </Button>
          <Button component={Link} to="/register-department-admin" variant="contained" sx={{ mr: 2, mb: 1 }}>
            Register Department & Department Admin (HOD)
          </Button>
          <Button component={Link} to="/register-website-manager" variant="contained" sx={{ mr: 2, mb: 1 }}>
            Register Website Manager
          </Button>
          <Button component={Link} to="/notifications" variant="outlined" sx={{ mr: 2, mb: 1 }}>
            View Notifications
          </Button>
        </Paper>
      </Container>
    </Box>
  )
}

import React from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Button,
  Container,
  Paper,
  Chip
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import SchoolIcon from '@mui/icons-material/School'
import NotificationsIcon from '@mui/icons-material/Notifications'
import AssignmentIcon from '@mui/icons-material/Assignment'
import api from '../api'

export default function AdminDashboard() {
  const [counts, setCounts] = React.useState({
    totalUsers: 0,
    faculty: 0,
    students: 0,
    subjects: 0,
    assignments: 0,
    notifications: 0
  })
  const [dept, setDept] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchOverview()
  }, [])

  async function fetchOverview() {
    setLoading(true)
    try {
      // 1️⃣ Get admin profile
      const profileRes = await api.get('/auth/profile')
      const deptName = profileRes.data.user.department
      setDept(deptName)

      // 2️⃣ Fetch department-based data freshly
      const [usersRes, deptRes, notifRes, assignRes] = await Promise.all([
        api.get('/admin/users'),              // MUST return latest users
        api.get(`/departments/${deptName}`),
        api.get('/notifications'),
        api.get('/assignments')
      ])

      const users = usersRes.data.users || []
      setCounts({
        totalUsers: users.length,
        faculty: users.filter((user) => user.role === 'faculty').length,
        students: users.filter((user) => user.role === 'student').length,
        subjects: deptRes.data.department?.subjects?.length || 0,
        assignments: assignRes.data.assignments?.length || 0,
        notifications: notifRes.data.notifications?.length || 0
      })
    } catch (err) {
      console.error('Admin dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ icon: Icon, label, value, color, path }) => (
    <Grid item xs={12} sm={6} md={4}>
      <Card
        component={path ? Link : 'div'}
        to={path || '#'}
        sx={{
          height: '100%',
          textDecoration: 'none',
          background: `linear-gradient(135deg, ${color}20, ${color}10)`,
          border: `2px solid ${color}40`,
          transition: '0.3s',
          '&:hover': path && {
            transform: 'translateY(-6px)',
            boxShadow: `0 8px 20px ${color}40`
          }
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

  const ActionButton = ({ icon: Icon, label, path, color }) => (
    <Button
      component={Link}
      to={path}
      fullWidth
      startIcon={<Icon />}
      sx={{
        mb: 1.5,
        py: 1.4,
        fontWeight: 'bold',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#fff',
        '&:hover': {
          background: `linear-gradient(135deg, ${color}cc, ${color})`
        }
      }}
    >
      {label}
    </Button>
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#fafafa' }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <DashboardIcon sx={{ fontSize: 36, color: '#667eea' }} />
            <Typography variant="h3" fontWeight="bold">
              Department Admin (HOD) Dashboard
            </Typography>
          </Box>

          <Chip
            icon={<SchoolIcon />}
            label={`Department: ${dept}`}
            sx={{ mt: 2 }}
            color="primary"
            variant="outlined"
          />
        </Box>

        {/* Stats */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <StatCard
            icon={PeopleIcon}
            label="Total Users"
            value={counts.totalUsers}
            color="#667eea"
            path="/manage-users"
          />
          <StatCard
            icon={SchoolIcon}
            label="Faculty"
            value={counts.faculty}
            color="#16a085"
            path="/manage-users"
          />
          <StatCard
            icon={AssignmentIcon}
            label="Assignments"
            value={counts.assignments}
            color="#e74c3c"
          />
          <StatCard
            icon={PeopleIcon}
            label="Students"
            value={counts.students}
            color="#2980b9"
            path="/manage-users"
          />
          <StatCard
            icon={SchoolIcon}
            label="Subjects"
            value={counts.subjects}
            color="#f39c12"
          />
          <StatCard
            icon={NotificationsIcon}
            label="Notifications"
            value={counts.notifications}
            color="#27ae60"
            path="/notifications"
          />
        </Grid>

        {/* Actions */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Department Admin (HOD) Actions
              </Typography>

              <ActionButton
                icon={PeopleIcon}
                label="Manage Users"
                path="/manage-users"
                color="#667eea"
              />

              <ActionButton
                icon={SchoolIcon}
                label="Manage Subjects"
                path="/manage-subjects"
                color="#f39c12"
              />

              <ActionButton
                icon={NotificationsIcon}
                label="Send Notification"
                path="/notifications"
                color="#27ae60"
              />

              <ActionButton
                icon={AssignmentIcon}
                label="Activity Logs"
                path="/activity-logs"
                color="#e74c3c"
              />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PeopleIcon from '@mui/icons-material/People'
import SchoolIcon from '@mui/icons-material/School'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import PermMediaIcon from '@mui/icons-material/PermMedia'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import DomainAddIcon from '@mui/icons-material/DomainAdd'
import { useAuth } from '../context/AuthContext'

const DRAWER_WIDTH = 250

export default function Sidebar({ mobileOpen, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isWebsiteManager = user?.role === 'admin' && !user?.department
  const isDepartmentHod = user?.role === 'hod' || (user?.role === 'admin' && !!user?.department)
  const dashboardPath = isWebsiteManager ? '/website-manager-dashboard' : '/dashboard'

  const menuItems = [
    { label: 'Dashboard', path: dashboardPath, icon: <DashboardIcon /> },

    ...(!(isWebsiteManager || isDepartmentHod)
      ? [{ label: 'Assignments', path: '/assignments', icon: <AssignmentIcon /> }]
      : []),

    ...(user?.role === 'faculty'
      ? [
          { label: 'Upload Materials', path: '/upload-materials', icon: <CloudUploadIcon /> },
          { label: 'Verify Materials', path: '/faculty-verification', icon: <VerifiedUserIcon /> }
        ]
      : []),

    ...(user?.role === 'student'
      ? [{ label: 'Study Materials', path: '/materials', icon: <PermMediaIcon /> }]
      : []),

    { label: 'Notifications', path: '/notifications', icon: <NotificationsIcon /> },
  ]

  if (isWebsiteManager) {
    menuItems.push(
      { label: 'Website Manager', path: '/website-manager', icon: <PeopleIcon /> },
      { label: 'Register Department + Admin (HOD)', path: '/register-department-admin', icon: <DomainAddIcon /> },
      { label: 'Register Website Manager', path: '/register-website-manager', icon: <VerifiedUserIcon /> }
    )
  }

  if (isDepartmentHod) {
    menuItems.push(
      { label: 'Manage Users', path: '/manage-users', icon: <PeopleIcon /> },
      { label: 'Manage Subjects', path: '/manage-subjects', icon: <SchoolIcon /> }
    )
  }

  const content = (
    <Box sx={{ width: DRAWER_WIDTH, p: 2 }}>
      <List>
        {menuItems.map(item => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path)
              onClose?.()
            }}
            sx={{
              borderRadius: 1,
              mb: 1,
              '&.Mui-selected': {
                backgroundColor: '#e3f2fd',
                '& .MuiListItemIcon-root': { color: '#1976d2' }
              }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <>
      {/* Desktop */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH,
          backgroundColor: '#f5f5f5',
          borderRight: '1px solid #ddd',
          minHeight: '100%'
        }}
      >
        {content}
      </Box>

      {/* Mobile */}
      <Drawer
        open={mobileOpen}
        onClose={onClose}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH }
        }}
      >
        {content}
      </Drawer>
    </>
  )
}

export { DRAWER_WIDTH }

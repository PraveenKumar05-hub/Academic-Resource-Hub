import React from 'react'
import { Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

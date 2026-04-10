import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CssBaseline, IconButton, ThemeProvider, createTheme } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'

import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Assignments from './pages/Assignments'
import Notifications from './pages/Notifications'
import ManageUsers from './pages/ManageUsers'
import ActivityLogs from './pages/ActivityLogs'
import Tests from './pages/Tests'
import ManageSubjects from './pages/ManageSubjects'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import UploadMaterials from './pages/UploadMaterials'
import ViewMaterials from './pages/ViewMaterials'
import FacultyVerification from './pages/FacultyVerification'
import FacultyStudents from './pages/FacultyStudents'
import Profile from './pages/Profile'
import WebsiteManagerDashboard from './pages/WebsiteManagerDashboard'
import RegisterDepartmentAdmin from './pages/RegisterDepartmentAdmin'
import RegisterWebsiteManager from './pages/RegisterWebsiteManager'

function AppContent() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAuthenticated = !!user

  const theme = createTheme({
    palette: {
      mode: 'light',
      primary: { main: '#667eea' }
    }
  })

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <>
        {/* Header */}
        {isAuthenticated && <Header />}

        {/* Layout BELOW header */}
        <Box
          sx={{
            display: 'flex',
            minHeight: '100vh',
            backgroundColor: isAuthenticated ? 'background.default' : 'background.paper'
          }}
        >
          {/* Sidebar */}
          {isAuthenticated && (
            <Sidebar
              mobileOpen={mobileOpen}
              onClose={() => setMobileOpen(false)}
            />
          )}

          {/* Main content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: isAuthenticated ? 3 : 0
            }}
          >
            {/* Mobile menu button */}
            {isAuthenticated && (
              <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{ display: { xs: 'block', sm: 'none' }, mb: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Routes>
              {/* ---------- PUBLIC ROUTES ---------- */}
              {!isAuthenticated && (
                <>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </>
              )}

              {/* ---------- PROTECTED ROUTES ---------- */}
              {isAuthenticated && (
                <>
                  <Route
                    path="/website-manager-dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <WebsiteManagerDashboard />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/assignments"
                    element={
                      <ProtectedRoute allowedRoles={['student', 'faculty']}>
                        <Assignments />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/tests"
                    element={
                      <ProtectedRoute allowedRoles={['student', 'faculty', 'hod', 'admin']}>
                        <Tests />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/activity-logs"
                    element={
                      <ProtectedRoute allowedRoles={['admin', 'hod', 'faculty']}>
                        <ActivityLogs />
                      </ProtectedRoute>
                    }
                  />

                <Route
                  path="/website-manager"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ManageUsers />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/manage-users"
                  element={
                    <ProtectedRoute allowedRoles={['hod', 'admin']}>
                      <ManageUsers />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/register-department-admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <RegisterDepartmentAdmin />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/register-website-manager"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <RegisterWebsiteManager />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/manage-subjects"
                  element={
                    <ProtectedRoute allowedRoles={['hod', 'admin']}>
                      <ManageSubjects />
                    </ProtectedRoute>
                  }
                />

                <Route path="/manage-users-legacy" element={<Navigate to="/website-manager" replace />} />

                <Route
                  path="/upload-materials"
                  element={
                    <ProtectedRoute allowedRoles={['faculty']}>
                      <UploadMaterials />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/materials"
                  element={
                    <ProtectedRoute allowedRoles={['student', 'faculty']}>
                      <ViewMaterials />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/faculty-verification"
                  element={
                    <ProtectedRoute allowedRoles={['faculty']}>
                      <FacultyVerification />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/faculty-students"
                  element={
                    <ProtectedRoute allowedRoles={['faculty']}>
                      <FacultyStudents />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/dashboard" />} />
              </>
            )}
            </Routes>
          </Box>
        </Box>
      </>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

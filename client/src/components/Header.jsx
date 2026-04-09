import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  Avatar, 
  Menu, 
  MenuItem,
  IconButton
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useAuth } from '../context/AuthContext'
import { useThemeMode } from '../context/ThemeModeContext'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const [anchorEl, setAnchorEl] = React.useState(null)

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget)
  const handleMenuClose = () => setAnchorEl(null)

  const handleLogout = () => {
    logout()
    handleMenuClose()
    navigate('/')
  }

  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#1976d2' }}>
      <Toolbar>
        <Typography 
          variant="h6" 
          sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          📚 Academic Resource Hub
        </Typography>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit" onClick={toggleMode} aria-label="toggle theme">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <Avatar 
              sx={{ 
                backgroundColor: '#ff6b6b',
                cursor: 'pointer',
                width: 40, 
                height: 40 
              }}
              onClick={handleMenuOpen}
            >
              {user.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem disabled>
                <Typography variant="subtitle2">{user.name}</Typography>
              </MenuItem>
              <MenuItem disabled>
                <Typography variant="caption">{user.role}</Typography>
              </MenuItem>
              {user?.role === 'student' && (
                <MenuItem disabled>
                  <Typography variant="caption">Year: {user?.year || 'N/A'}</Typography>
                </MenuItem>
              )}
              <MenuItem onClick={() => { navigate('/profile'); handleMenuClose() }}>
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  )
}

import React from 'react'
import { Box, Card, CardContent, Typography, Grid, Chip } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user } = useAuth()

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
        Profile
      </Typography>

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Name</Typography>
              <Typography variant="h6">{user?.name || 'N/A'}</Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Role</Typography>
              <Chip label={(user?.role || 'N/A').toUpperCase()} size="small" />
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">Department</Typography>
              <Typography variant="h6">{user?.department || 'N/A'}</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">Year</Typography>
              <Typography variant="h6">{user?.role === 'student' ? (user?.year || 'N/A') : 'N/A'}</Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">Section</Typography>
              <Typography variant="h6">{user?.role === 'student' ? (user?.section || 'N/A') : 'N/A'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}

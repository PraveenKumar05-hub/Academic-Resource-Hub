import React, { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import DownloadIcon from '@mui/icons-material/Download'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/Delete'
import api from '../api'
import { useAuth } from '../context/AuthContext'
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function ActivityLogs() {
  const { user } = useAuth()
  const canDeleteLogs = user?.role === 'admin' || user?.role === 'hod' || user?.role === 'faculty'
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    fetchLogs(1)
  }, [])

  async function fetchLogs(nextPage = page) {
    setLoading(true)
    try {
      const params = {
        page: nextPage,
        limit,
        search: search.trim() || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entityType: entityFilter !== 'all' ? entityFilter : undefined
      }
      const res = await api.get('/activity-logs', { params })
      setLogs(res.data.logs || [])
      setPage(res.data.page || nextPage)
      setTotal(res.data.total || 0)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  function exportLogs() {
    api.get('/activity-logs/export', {
      params: {
        search: search.trim() || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entityType: entityFilter !== 'all' ? entityFilter : undefined
      },
      responseType: 'blob'
    }).then((res) => {
      downloadBlob('activity-logs.csv', new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
    }).catch(() => {
      setError('Failed to export activity logs')
    })
  }

  async function deleteLog(logId) {
    if (!window.confirm('Delete this activity log?')) {
      return
    }

    try {
      await api.delete(`/activity-logs/${logId}`)
      setSuccess('Activity log deleted successfully')
      await fetchLogs(page)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to delete activity log')
    }
  }

  async function deleteFilteredLogs() {
    if (!window.confirm('Delete all logs matching current filters?')) {
      return
    }

    try {
      const params = {
        search: search.trim() || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entityType: entityFilter !== 'all' ? entityFilter : undefined
      }

      const res = await api.delete('/activity-logs', { params })
      const count = res.data?.deletedCount || 0
      setSuccess(`Deleted ${count} filtered activity log(s)`)
      await fetchLogs(1)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to delete filtered activity logs')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HistoryIcon sx={{ fontSize: 32, color: '#667eea' }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Activity Logs
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportLogs}>
            Export CSV
          </Button>
          {canDeleteLogs && (
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={deleteFilteredLogs}>
              Delete Filtered
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search summaries, actions, or entity types"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select value={actionFilter} label="Action" onChange={(e) => setActionFilter(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="user_create">User Created</MenuItem>
                  <MenuItem value="user_update">User Updated</MenuItem>
                  <MenuItem value="user_delete">User Deleted</MenuItem>
                  <MenuItem value="bulk_user_import">Bulk Import</MenuItem>
                  <MenuItem value="notification_create">Notification Sent</MenuItem>
                  <MenuItem value="notification_delete">Notification Deleted</MenuItem>
                  <MenuItem value="password_reset">Password Reset</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Entity</InputLabel>
                <Select value={entityFilter} label="Entity" onChange={(e) => setEntityFilter(e.target.value)}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="notification">Notification</MenuItem>
                  <MenuItem value="department">Department</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" onClick={() => fetchLogs(1)} startIcon={<SearchIcon />}>
                Filter
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : logs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>No activity logs found</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Actor</TableCell>
                {canDeleteLogs && <TableCell align="center">Delete</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell>{log.summary}</TableCell>
                  <TableCell>{log.department || '-'}</TableCell>
                  <TableCell>{log.actor ? `${log.actor.name} (${log.actor.email})` : '-'}</TableCell>
                  {canDeleteLogs && (
                    <TableCell align="center">
                      <Button
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => deleteLog(log._id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_event, value) => fetchLogs(value)}
          />
        </Box>
      )}
    </Box>
  )
}
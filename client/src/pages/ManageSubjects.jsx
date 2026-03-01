import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material'
import SchoolIcon from '@mui/icons-material/School'
import DeleteIcon from '@mui/icons-material/Delete'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function ManageSubjects() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [departmentName, setDepartmentName] = useState('')
  const [yearConfigs, setYearConfigs] = useState({
    year1: { subjects: [], sections: [] },
    year2: { subjects: [], sections: [] },
    year3: { subjects: [], sections: [] },
    year4: { subjects: [], sections: [] }
  })
  const [subjectInputs, setSubjectInputs] = useState({ year1: '', year2: '', year3: '', year4: '' })
  const [subjectCredits, setSubjectCredits] = useState({ year1: '', year2: '', year3: '', year4: '' })
  const [sectionInputs, setSectionInputs] = useState({ year1: '', year2: '', year3: '', year4: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isWebsiteManager = user?.role === 'admin' && !user?.department
  const canManageSubjects = user?.role === 'hod' || (user?.role === 'admin' && !!user?.department)

  useEffect(() => {
    if (user?.department) {
      fetchDepartment(user.department)
    } else {
      setLoading(false)
    }
  }, [user?.department])

  async function fetchDepartment(name) {
    setLoading(true)
    try {
      const res = await api.get(`/departments/${name}`)
      const dept = res.data?.department || {}
      setDepartmentName(dept.name || name)

      const configs = dept.yearConfigs || {}
      setYearConfigs({
        year1: {
          subjects: (configs?.year1?.subjects || []).map((item) =>
            typeof item === 'string' ? { name: item, credits: 0 } : item
          ),
          sections: configs?.year1?.sections || []
        },
        year2: {
          subjects: (configs?.year2?.subjects || []).map((item) =>
            typeof item === 'string' ? { name: item, credits: 0 } : item
          ),
          sections: configs?.year2?.sections || []
        },
        year3: {
          subjects: (configs?.year3?.subjects || []).map((item) =>
            typeof item === 'string' ? { name: item, credits: 0 } : item
          ),
          sections: configs?.year3?.sections || []
        },
        year4: {
          subjects: (configs?.year4?.subjects || []).map((item) =>
            typeof item === 'string' ? { name: item, credits: 0 } : item
          ),
          sections: configs?.year4?.sections || []
        }
      })
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load department details')
    } finally {
      setLoading(false)
    }
  }

  function yearNumber(yearKey) {
    return Number(String(yearKey).replace('year', ''))
  }

  async function addSubject(yearKey) {
    const input = subjectInputs[yearKey]
    if (!input?.trim()) return
    if (subjectCredits[yearKey] === '' || subjectCredits[yearKey] === null || subjectCredits[yearKey] === undefined) {
      setError('Please enter credits before adding a subject')
      return
    }
    try {
      await api.post(`/departments/${departmentName}/subjects`, {
        subject: input.trim(),
        credits: Number(subjectCredits[yearKey] || 0),
        year: yearNumber(yearKey)
      })
      setSuccess('Subject added successfully')
      setSubjectInputs((prev) => ({ ...prev, [yearKey]: '' }))
      setSubjectCredits((prev) => ({ ...prev, [yearKey]: '' }))
      fetchDepartment(departmentName)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add subject')
    }
  }

  async function removeSubject(yearKey, subject) {
    try {
      await api.delete(`/departments/${departmentName}/subjects`, {
        data: { subject, year: yearNumber(yearKey) }
      })
      setSuccess('Subject removed successfully')
      fetchDepartment(departmentName)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove subject')
    }
  }

  async function addSection(yearKey) {
    const input = sectionInputs[yearKey]
    if (!input?.trim()) return
    try {
      await api.post(`/departments/${departmentName}/sections`, {
        section: input.trim().toUpperCase(),
        year: yearNumber(yearKey)
      })
      setSuccess('Section added successfully')
      setSectionInputs((prev) => ({ ...prev, [yearKey]: '' }))
      fetchDepartment(departmentName)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add section')
    }
  }

  async function removeSection(yearKey, section) {
    try {
      await api.delete(`/departments/${departmentName}/sections`, {
        data: { section, year: yearNumber(yearKey) }
      })
      setSuccess('Section removed successfully')
      fetchDepartment(departmentName)
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove section')
    }
  }

  const yearBlocks = [
    { key: 'year1', label: '1st Year' },
    { key: 'year2', label: '2nd Year' },
    { key: 'year3', label: '3rd Year' },
    { key: 'year4', label: '4th Year' }
  ]

  if (isWebsiteManager) {
    return <Navigate to="/website-manager-dashboard" replace />
  }

  if (!canManageSubjects) {
    return <Navigate to="/dashboard" replace />
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <SchoolIcon sx={{ fontSize: 32, color: '#667eea' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Manage Subjects & Sections ({departmentName})
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {yearBlocks.map((block) => (
          <Grid item xs={12} md={6} key={block.key}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>{block.label}</Typography>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Subjects</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Add subject - ${block.label}`}
                    value={subjectInputs[block.key] || ''}
                    onChange={(e) => setSubjectInputs((prev) => ({ ...prev, [block.key]: e.target.value }))}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Credits"
                    value={subjectCredits[block.key] || ''}
                    onChange={(e) => setSubjectCredits((prev) => ({ ...prev, [block.key]: e.target.value }))}
                    sx={{ width: 120 }}
                    inputProps={{ min: 0 }}
                    required
                  />
                  <Button variant="contained" onClick={() => addSubject(block.key)}>Add</Button>
                </Box>
                <Paper sx={{ p: 2, minHeight: 80, mb: 2 }}>
                  {(yearConfigs[block.key]?.subjects || []).length === 0 ? (
                    <Typography color="text.secondary">No subjects</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {(yearConfigs[block.key]?.subjects || []).map((subjectObj) => (
                        <Chip
                          key={`${block.key}-${subjectObj.name}`}
                          label={`${subjectObj.name} (${Number(subjectObj.credits || 0)} cr)`}
                          onDelete={() => removeSubject(block.key, subjectObj.name)}
                          deleteIcon={<DeleteIcon />}
                        />
                      ))}
                    </Box>
                  )}
                </Paper>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Sections</Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Add section - ${block.label}`}
                    value={sectionInputs[block.key] || ''}
                    onChange={(e) => setSectionInputs((prev) => ({ ...prev, [block.key]: e.target.value }))}
                  />
                  <Button variant="contained" onClick={() => addSection(block.key)}>Add</Button>
                </Box>
                <Paper sx={{ p: 2, minHeight: 80 }}>
                  {(yearConfigs[block.key]?.sections || []).length === 0 ? (
                    <Typography color="text.secondary">No sections</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {(yearConfigs[block.key]?.sections || []).map((section) => (
                        <Chip
                          key={`${block.key}-${section}`}
                          label={section}
                          onDelete={() => removeSection(block.key, section)}
                          deleteIcon={<DeleteIcon />}
                        />
                      ))}
                    </Box>
                  )}
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

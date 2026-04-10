import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import api from '../api'

export default function FacultyStudents() {
  const [department, setDepartment] = React.useState('')
  const [students, setStudents] = React.useState([])
  const [yearFilter, setYearFilter] = React.useState('')
  const [sectionFilter, setSectionFilter] = React.useState('all')
  const [batchFilter, setBatchFilter] = React.useState('all')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    loadStudents()
  }, [])

  async function loadStudents() {
    setLoading(true)
    setError('')
    try {
      const profileRes = await api.get('/auth/profile')
      const dept = profileRes.data?.user?.department || ''
      setDepartment(dept)

      const studentsRes = await api.get(`/admin/users?department=${encodeURIComponent(dept)}&role=student`)
      const list = studentsRes.data?.users || []
      setStudents(list)

      const years = Array.from(new Set(list.map((student) => Number(student.year)).filter(Boolean))).sort((a, b) => a - b)
      if (years.length > 0) {
        setYearFilter(String(years[0]))
      }
      setSectionFilter('all')
      setBatchFilter('all')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const availableYears = React.useMemo(
    () => Array.from(new Set(students.map((student) => Number(student.year)).filter(Boolean))).sort((a, b) => a - b),
    [students]
  )

  const filteredStudents = React.useMemo(() => {
    if (!yearFilter) return []
    return students.filter((student) => {
      const isYearMatch = String(student.year || '') === yearFilter
      const isSectionMatch = sectionFilter === 'all' || String(student.section || '').toUpperCase() === sectionFilter
      const isBatchMatch = batchFilter === 'all' || String(student.batch || '') === batchFilter
      return isYearMatch && isSectionMatch && isBatchMatch
    })
  }, [students, yearFilter, sectionFilter, batchFilter])

  const studentsByYear = React.useMemo(() => {
    if (!yearFilter) return []
    return students.filter((student) => String(student.year || '') === yearFilter)
  }, [students, yearFilter])

  const availableSections = React.useMemo(
    () => Array.from(new Set(studentsByYear.map((student) => String(student.section || '').toUpperCase()).filter(Boolean))).sort(),
    [studentsByYear]
  )

  const availableBatches = React.useMemo(() => {
    const source = sectionFilter === 'all'
      ? studentsByYear
      : studentsByYear.filter((student) => String(student.section || '').toUpperCase() === sectionFilter)
    return Array.from(new Set(source.map((student) => String(student.batch || '').trim()).filter(Boolean))).sort()
  }, [studentsByYear, sectionFilter])

  React.useEffect(() => {
    setSectionFilter('all')
    setBatchFilter('all')
  }, [yearFilter])

  React.useEffect(() => {
    setBatchFilter('all')
  }, [sectionFilter])

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                Students List {department ? `- ${department}` : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Year</InputLabel>
                <Select value={yearFilter} label="Year" onChange={(e) => setYearFilter(e.target.value)}>
                  {availableYears.map((year) => (
                    <MenuItem key={year} value={String(year)}>{`Year ${year}`}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }} disabled={!yearFilter}>
                <InputLabel>Section</InputLabel>
                <Select value={sectionFilter} label="Section" onChange={(e) => setSectionFilter(e.target.value)}>
                  <MenuItem value="all">All Sections</MenuItem>
                  {availableSections.map((section) => (
                    <MenuItem key={section} value={section}>{section}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }} disabled={!yearFilter}>
                <InputLabel>Batch</InputLabel>
                <Select value={batchFilter} label="Batch" onChange={(e) => setBatchFilter(e.target.value)}>
                  <MenuItem value="all">All Batches</MenuItem>
                  {availableBatches.map((batch) => (
                    <MenuItem key={batch} value={batch}>{batch}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : !yearFilter ? (
            <Typography variant="body2" color="text.secondary">No year data available</Typography>
          ) : filteredStudents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No students found for selected year</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Year</TableCell>
                    <TableCell>Section</TableCell>
                    <TableCell>Academic Batch</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone || '-'}</TableCell>
                      <TableCell>{student.year || '-'}</TableCell>
                      <TableCell>{student.section || '-'}</TableCell>
                      <TableCell>{student.batch || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

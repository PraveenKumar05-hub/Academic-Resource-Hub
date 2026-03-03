import React from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';

function generateCommonBatchOptions() {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2;
  const totalOptions = 10;

  return Array.from({ length: totalOptions }, (_, index) => {
    const admissionYear = startYear + index;
    const graduationYear = admissionYear + 4;
    return `${admissionYear}-${graduationYear}`;
  });
}

export default function FacultyDashboard() {
  const [dept, setDept] = React.useState(null);
  const [assignments, setAssignments] = React.useState([]);
  const [students, setStudents] = React.useState([]);
  const [yearFilter, setYearFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(false);
  const commonBatchOptions = React.useMemo(() => generateCommonBatchOptions(), []);

  // Add/Edit Student Dialog
  const [openDialog, setOpenDialog] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [studentForm, setStudentForm] = React.useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    year: 1,
    section: 'A',
    batch: ''
  });

  React.useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const profile = await api.get('/auth/profile');
      setDept(profile.data.user.department);

      const [assignRes, studentRes] = await Promise.all([
        api.get('/assignments'),
        api.get(`/admin/users?department=${profile.data.user.department}&role=student`)
      ]);

      setAssignments(assignRes.data.assignments || []);
      setStudents(studentRes.data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Assignment Actions
  async function deleteAssignment(id) {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await api.delete(`/assignments/${id}`);
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  // Student Actions
  function openAddStudentDialog() {
    setEditingId(null);
    setStudentForm({ name: '', email: '', phone: '', password: '', year: 1, section: 'A', batch: '' });
    setError('');
    setSuccess('');
    setOpenDialog(true);
  }

  function openEditStudentDialog(student) {
    setEditingId(student._id);
    setStudentForm({
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      password: '',
      year: student.year || 1,
      section: student.section || 'A',
      batch: student.batch || ''
    });
    setOpenDialog(true);
  }

  async function saveStudent() {
    if (!studentForm.name || !studentForm.email || (!studentForm.password && !editingId)) {
      setError('Name, Email, and Password are required');
      return;
    }

    if (!String(studentForm.batch || '').trim()) {
      setError('Academic batch is required for students');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const updateData = {
          name: studentForm.name,
          email: studentForm.email,
          phone: studentForm.phone,
          year: studentForm.year,
          section: studentForm.section,
          batch: studentForm.batch
        };
        if (studentForm.password) updateData.password = studentForm.password;

        await api.put(`/admin/users/${editingId}`, updateData);
        setSuccess('Student updated successfully!');
      } else {
        await api.post('/admin/users', {
          ...studentForm,
          role: 'student',
          department: dept
        });
        setSuccess('Student added successfully!');
      }

      setOpenDialog(false);
      setStudentForm({ name: '', email: '', phone: '', password: '', year: 1, section: 'A', batch: '' });
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStudent(id) {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setSuccess('Student deleted successfully!');
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  const availableYears = Array.from(
    new Set(students.map((student) => Number(student.year)).filter(Boolean))
  ).sort((a, b) => a - b);

  const filteredStudents =
    yearFilter === 'all'
      ? students
      : students.filter((student) => String(student.year || '') === yearFilter);

  return (
    <Box sx={{ display: 'flex', gap: 3, p: 3 }}>
      {/* Sidebar */}
      <Card sx={{ width: 260, flexShrink: 0 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Faculty Menu</Typography>
          <List>
            <ListItem button component={Link} to="/assignments">
              <ListItemText primary="Assignments" />
            </ListItem>
            <ListItem button component={Link} to="/upload-materials">
              <ListItemText primary="Upload Materials" />
            </ListItem>
            <ListItem button component={Link} to="/notifications">
              <ListItemText primary="Class Notices" />
            </ListItem>
            <ListItem button component={Link} to="/faculty-verification">
              <ListItemText primary="Teaching Mode" />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Faculty Dashboard — {dept || '—'}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddStudentDialog}>
            Add Student
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Recent Assignments */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AssignmentIcon color="primary" />
                    <Typography variant="h6">Recent Assignments</Typography>
                  </Box>
                  {assignments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No assignments found</Typography>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell>Due Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {assignments.map(a => (
                            <TableRow key={a._id}>
                              <TableCell>{a.title}</TableCell>
                              <TableCell>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'N/A'}</TableCell>
                              <TableCell>{a.submissions?.length || 0} submitted</TableCell>
                              <TableCell align="center">
                                <Button size="small" startIcon={<EditIcon />} sx={{ mr: 1 }}>Edit</Button>
                                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => deleteAssignment(a._id)}>Delete</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Students Table */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">Students — {dept}</Typography>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Year</InputLabel>
                      <Select
                        value={yearFilter}
                        label="Year"
                        onChange={(e) => setYearFilter(e.target.value)}
                      >
                        <MenuItem value="all">All Years</MenuItem>
                        {availableYears.map((year) => (
                          <MenuItem key={year} value={String(year)}>{`Year ${year}`}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  {filteredStudents.length === 0 ? (
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
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredStudents.map(s => (
                            <TableRow key={s._id}>
                              <TableCell>{s.name}</TableCell>
                              <TableCell>{s.email}</TableCell>
                              <TableCell>{s.phone || '-'}</TableCell>
                              <TableCell>{s.year || '-'}</TableCell>
                              <TableCell>{s.section || '-'}</TableCell>
                              <TableCell>{s.batch || '-'}</TableCell>
                              <TableCell align="center">
                                <Button size="small" startIcon={<EditIcon />} sx={{ mr: 1 }} onClick={() => openEditStudentDialog(s)}>Edit</Button>
                                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => deleteStudent(s._id)}>Delete</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Add/Edit Student Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingId ? 'Edit Student' : 'Add Student'}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Full Name"
              value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Email"
              value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Phone Number"
              value={studentForm.phone}
              onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
              margin="normal"
              placeholder="e.g. +919876543210"
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={studentForm.password}
              onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
              margin="normal"
              placeholder={editingId ? 'Leave blank to keep current password' : ''}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Year</InputLabel>
              <Select value={studentForm.year} onChange={(e) => setStudentForm({ ...studentForm, year: e.target.value })} label="Year">
                <MenuItem value={1}>1st Year</MenuItem>
                <MenuItem value={2}>2nd Year</MenuItem>
                <MenuItem value={3}>3rd Year</MenuItem>
                <MenuItem value={4}>4th Year</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Section"
              value={studentForm.section}
              onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Academic Batch</InputLabel>
              <Select
                value={studentForm.batch}
                onChange={(e) => setStudentForm({ ...studentForm, batch: e.target.value })}
                label="Academic Batch"
              >
                <MenuItem value="">
                  <em>Select Academic Batch</em>
                </MenuItem>
                {commonBatchOptions.map((batch) => (
                  <MenuItem key={batch} value={batch}>{batch}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={saveStudent} disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Add Student'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Box, 
  Typography, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress,
  Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';

const FacultyVerification = () => {
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: '', id: '', title: '' });
  const [tabValue, setTabValue] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      // Fetch materials
      const materialsRes = await axios.get('http://localhost:5000/api/materials', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const materialsData = Array.isArray(materialsRes.data)
        ? materialsRes.data
        : (materialsRes.data?.materials || []);
      setMaterials(materialsData);
      console.log('✓ Materials fetched:', materialsData.length);

      // Fetch assignments
      const assignRes = await axios.get('http://localhost:5000/api/assignments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const assignmentsData = Array.isArray(assignRes.data)
        ? assignRes.data
        : (assignRes.data?.assignments || []);
      setAssignments(assignmentsData);
      console.log('✓ Assignments fetched:', assignmentsData.length);

    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to fetch data: ' + (error.response?.data?.message || error.message) 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteDialog.id) return;

    const token = localStorage.getItem('token');
    const endpoint = deleteDialog.type === 'material' 
      ? `http://localhost:5000/api/materials/${deleteDialog.id}`
      : `http://localhost:5000/api/assignments/${deleteDialog.id}`;

    try {
      console.log(`\n🗑️ DELETE REQUEST`);
      console.log('Type:', deleteDialog.type);
      console.log('ID:', deleteDialog.id);
      console.log('Endpoint:', endpoint);
      console.log('Token length:', token?.length);
      
      const response = await axios.delete(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('✓ Delete successful:', response.data);
      setMessage({ 
        type: 'success', 
        text: `${deleteDialog.type === 'material' ? 'Material' : 'Assignment'} deleted successfully ✓` 
      });

      // Refresh data
      await fetchData();
      
    } catch (error) {
      console.error('\n❌ DELETE ERROR');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      console.error('Message:', error.message);
      
      let errorMsg = 'Failed to delete';
      
      if (error.response?.status === 404) {
        errorMsg = `❌ ${deleteDialog.type === 'material' ? 'Material' : 'Assignment'} not found (404)`;
      } else if (error.response?.status === 401) {
        errorMsg = '❌ Authentication failed - please login again';
      } else if (error.response?.status === 403) {
        errorMsg = '❌ You cannot delete items from other departments';
      } else {
        errorMsg = 'Failed to delete: ' + (error.response?.data?.message || error.message);
      }
      
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setDeleteDialog({ open: false, type: '', id: '', title: '' });
    }
  };

  const openDeleteDialog = (type, id, title) => {
    setDeleteDialog({ open: true, type, id, title });
  };

  const downloadFile = async (materialIdOrUrl, fileName, isAssignment = false) => {
    const token = localStorage.getItem('token')
    if (!token) {
      alert('Please login to download files')
      return
    }
    
    try {
      const downloadUrl = isAssignment
        ? `http://localhost:5000/api/assignments/${materialIdOrUrl}/download?token=${token}`
        : `http://localhost:5000/api/materials/download/${materialIdOrUrl}?token=${token}`

      console.log('Downloading:', downloadUrl)
      
      // Create temporary link and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName || 'file'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)
      
      console.log('✓ Download initiated')
    } catch (err) {
      console.error('Download error:', err)
      alert('Download failed: ' + err.message)
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            📋 Faculty Verification Dashboard
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Box>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
            {message.text}
          </Alert>
        )}

        {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

        {!loading && (
          <>
            <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
              <Tab label={`📚 Study Materials (${materials.length})`} />
              <Tab label={`📝 Assignments (${assignments.length})`} />
            </Tabs>

            {/* MATERIALS TAB */}
            {tabValue === 0 && (
              <>
                {materials.length === 0 ? (
                  <Alert severity="info">No study materials uploaded yet</Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell><strong>Title</strong></TableCell>
                          <TableCell><strong>Subject</strong></TableCell>
                          <TableCell><strong>Location</strong></TableCell>
                          <TableCell><strong>File</strong></TableCell>
                          <TableCell><strong>Uploaded</strong></TableCell>
                          <TableCell align="center"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {materials.map((material) => (
                          <TableRow key={material._id} hover>
                            <TableCell>{material.title}</TableCell>
                            <TableCell>{material.subject}</TableCell>
                            <TableCell>
                              <Chip 
                                label={`Dept ${material.department || 'N/A'} • Year ${material.year || 'N/A'} • Sec ${material.section || 'N/A'}`}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{material.fileName}</TableCell>
                            <TableCell>
                              {new Date(material.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                startIcon={<DownloadIcon />}
                                onClick={() => downloadFile(material._id, material.fileName)}
                                sx={{ mr: 1 }}
                              >
                                Download
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => openDeleteDialog('material', material._id, material.title)}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}

            {/* ASSIGNMENTS TAB */}
            {tabValue === 1 && (
              <>
                {assignments.length === 0 ? (
                  <Alert severity="info">No assignments created yet</Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableRow>
                          <TableCell><strong>Title</strong></TableCell>
                          <TableCell><strong>Subject</strong></TableCell>
                          <TableCell><strong>Year/Section</strong></TableCell>
                          <TableCell><strong>Due Date</strong></TableCell>
                          <TableCell><strong>File</strong></TableCell>
                          <TableCell><strong>Created</strong></TableCell>
                          <TableCell align="center"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {assignments.map((assignment) => (
                          <TableRow key={assignment._id} hover>
                            <TableCell>{assignment.title}</TableCell>
                            <TableCell>{assignment.subject}</TableCell>
                            <TableCell>
                              <Chip 
                                label={`Year ${assignment.year} - Section ${assignment.section}`}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {new Date(assignment.dueDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {assignment.fileUrl ? (
                                <Chip 
                                  label="📎 File Attached" 
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              ) : (
                                <Chip 
                                  label="No File" 
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(assignment.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="center">
                              {assignment.fileUrl && (
                                <Button
                                  size="small"
                                  startIcon={<DownloadIcon />}
                                  onClick={() => downloadFile(
                                    assignment._id,
                                    assignment.filename || assignment.fileUrl?.split('/').pop()?.split('?')[0] || assignment.title || 'assignment-file',
                                    true
                                  )}
                                  sx={{ mr: 1 }}
                                >
                                  Download
                                </Button>
                              )}
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => openDeleteDialog('assignment', assignment._id, assignment.title)}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </>
        )}
      </Paper>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, type: '', id: '', title: '' })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this {deleteDialog.type}?
            <br />
            <strong>{deleteDialog.title}</strong>
            <br />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, type: '', id: '', title: '' })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FacultyVerification;

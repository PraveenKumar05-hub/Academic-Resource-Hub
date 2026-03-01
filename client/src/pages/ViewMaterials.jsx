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
  CircularProgress,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import axios from 'axios';

const ViewMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [subjectOptions, setSubjectOptions] = useState([]);

  useEffect(() => {
    fetchMaterials(subjectFilter);
  }, [subjectFilter]);

  const fetchMaterials = async (selectedSubject = 'all') => {
    try {
      console.log('\n📥 Fetching materials...')
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.error('❌ No auth token found')
        setMaterials([])
        setLoading(false)
        return
      }
      
      const endpoint = selectedSubject === 'all'
        ? 'http://localhost:5000/api/materials'
        : `http://localhost:5000/api/materials?subject=${encodeURIComponent(selectedSubject)}`

      console.log('Token found, making request to:', endpoint)
      
      const response = await axios.get(
        endpoint,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        }
      )
      
      console.log('✓ Materials response received:', response.data)
      setMaterials(response.data)

      if (selectedSubject === 'all') {
        const allSubjects = Array.from(
          new Set(
            (response.data || [])
              .map((material) => String(material.subject || '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b))
        setSubjectOptions(allSubjects)
      }
      
    } catch (error) {
      console.error('❌ Error fetching materials:')
      console.error('Status:', error.response?.status)
      console.error('Data:', error.response?.data)
      console.error('Message:', error.message)
      
      if (error.response?.status === 404) {
        alert('Server endpoint not found (404). Check if server is running on port 5000')
      } else if (error.response?.status === 401) {
        alert('Authentication failed. Please login again.')
      } else {
        alert('Error loading materials: ' + (error.response?.data?.error || error.message))
      }
      
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (materialId, fileName) => {
    if (!materialId) {
      console.warn('No material ID available for:', fileName)
      alert('Material ID not available')
      return
    }
    const token = localStorage.getItem('token')
    if (!token) {
      alert('Please login to download files')
      return
    }
    
    try {
      console.log('Downloading material:', materialId)
      const downloadUrl = `http://localhost:5000/api/materials/download/${materialId}?token=${token}`
      
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
      
      console.log('✓ Download complete')
    } catch (err) {
      console.error('Download error:', err)
      alert('Download failed: ' + err.message)
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Study Materials
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Filter by Subject</InputLabel>
          <Select
            value={subjectFilter}
            label="Filter by Subject"
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <MenuItem value="all">All Subjects</MenuItem>
            {subjectOptions.map((subjectName) => (
              <MenuItem key={subjectName} value={subjectName}>
                {subjectName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {subjectFilter !== 'all' && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltIcon />}
            onClick={() => setSubjectFilter('all')}
          >
            Subject: {subjectFilter} (Clear)
          </Button>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Subject</strong></TableCell>
              <TableCell><strong>Section</strong></TableCell>
              <TableCell><strong>Year</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell align="center"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materials.length > 0 ? (
              materials.map((material) => (
                <TableRow key={material._id} hover>
                  <TableCell>{material.title}</TableCell>
                  <TableCell>{material.subject}</TableCell>
                  <TableCell>{material.section}</TableCell>
                  <TableCell>{material.year}</TableCell>
                  <TableCell>{material.department || 'N/A'}</TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownload(material._id, material.fileName || material.filename || material.title)}
                    >
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  {subjectFilter === 'all' ? 'No materials available' : 'No materials found for selected subject'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default ViewMaterials;

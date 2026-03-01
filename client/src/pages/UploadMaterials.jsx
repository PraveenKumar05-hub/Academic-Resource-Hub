import React, { useEffect, useState } from 'react';
import { Container, Paper, TextField, Button, Box, Typography, Alert, MenuItem } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from 'axios';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const UploadMaterials = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    section: '',
    year: '',
    departmentName: '',
  });
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [yearConfigs, setYearConfigs] = useState({
    year1: { subjects: [], sections: [] },
    year2: { subjects: [], sections: [] },
    year3: { subjects: [], sections: [] },
    year4: { subjects: [], sections: [] }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (!formData.departmentName) return;
    fetchDepartmentConfig(formData.departmentName);
  }, [formData.departmentName]);

  async function fetchDepartments() {
    try {
      const res = await api.get('/departments');
      const items = res.data?.departments || [];
      setDepartments(items);

      const preferredDepartment = user?.department || items[0] || '';
      if (preferredDepartment) {
        setFormData((prev) => ({
          ...prev,
          departmentName: preferredDepartment
        }));
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  }

  async function fetchDepartmentConfig(departmentName) {
    try {
      const res = await api.get(`/departments/${departmentName}`);
      const configs = res.data?.department?.yearConfigs || {};
      setYearConfigs({
        year1: {
          subjects: (configs?.year1?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year1?.sections || []
        },
        year2: {
          subjects: (configs?.year2?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year2?.sections || []
        },
        year3: {
          subjects: (configs?.year3?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year3?.sections || []
        },
        year4: {
          subjects: (configs?.year4?.subjects || []).map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean),
          sections: configs?.year4?.sections || []
        }
      });
    } catch (err) {
      console.error('Failed to fetch department config:', err);
    }
  }

  function getYearKey(yearValue) {
    const numericYear = Number(yearValue);
    if (![1, 2, 3, 4].includes(numericYear)) return null;
    return `year${numericYear}`;
  }

  const selectedYearKey = getYearKey(formData.year);
  const availableSubjects = selectedYearKey ? (yearConfigs[selectedYearKey]?.subjects || []) : [];
  const availableSections = selectedYearKey ? (yearConfigs[selectedYearKey]?.sections || []) : [];
  const canChooseFromSubjectList = !!selectedYearKey && availableSubjects.length > 0;
  const canChooseFromSectionList = !!selectedYearKey && availableSections.length > 0;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'departmentName') {
      setFormData({
        ...formData,
        departmentName: value,
        year: '',
        subject: '',
        section: ''
      });
      return;
    }
    if (name === 'year') {
      setFormData({ ...formData, [name]: value, subject: '', section: '' });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);

    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setMessage({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setLoading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('title', formData.title);
    uploadFormData.append('subject', formData.subject)
    uploadFormData.append('section', formData.section)
    uploadFormData.append('year', formData.year)
    uploadFormData.append('departmentName', formData.departmentName)
    uploadFormData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setMessage({ type: 'error', text: 'Not authenticated. Please login.' })
        return
      }
      
      console.log('\n📤 Uploading material...')
      console.log('Data:', { title: formData.title, subject: formData.subject, departmentName: formData.departmentName, year: formData.year, section: formData.section, fileName: file.name })
      console.log('Upload URL: http://localhost:5000/api/materials/upload')
      console.log('Token:', token.substring(0, 20) + '...')
      
      const response = await axios.post(
        `http://localhost:5000/api/materials/upload`,
        uploadFormData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      console.log('✓ Upload successful:', response.data)
      setMessage({ type: 'success', text: 'Material uploaded successfully! ✓' })
      setFormData({ title: '', description: '', subject: '', section: '', year: '', departmentName: '' })
      setFile(null);
      setFileInputKey((prev) => prev + 1);
    } catch (error) {
      console.error('\n❌ Upload error:')
      console.error('Status:', error.response?.status)
      console.error('Data:', error.response?.data)
      console.error('Message:', error.message)
      
      if (error.response?.status === 404) {
        setMessage({ type: 'error', text: '❌ Server endpoint not found (404). Check if server is running.' })
      } else if (error.response?.status === 401) {
        setMessage({ type: 'error', text: '❌ Authentication failed. Session may have expired.' })
      } else if (error.response?.status === 403) {
        setMessage({ type: 'error', text: '❌ Forbidden. Only faculty/admin can upload materials.' })
      } else {
        setMessage({ type: 'error', text: 'Error uploading: ' + (error.response?.data?.error || error.response?.data?.message || error.message) })
      };
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUploadIcon /> Upload Study Material
        </Typography>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
            fullWidth
          />
          <TextField
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            multiline
            rows={3}
            fullWidth
          />
          <TextField
            select
            label="Year"
            name="year"
            value={formData.year}
            onChange={handleInputChange}
            required
            fullWidth
          >
            <MenuItem value="1">1st Year</MenuItem>
            <MenuItem value="2">2nd Year</MenuItem>
            <MenuItem value="3">3rd Year</MenuItem>
            <MenuItem value="4">4th Year</MenuItem>
          </TextField>
          {canChooseFromSubjectList ? (
            <TextField
              select
              label="Subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              required
              fullWidth
            >
              {availableSubjects.map((subject) => (
                <MenuItem key={subject} value={subject}>{subject}</MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              required
              fullWidth
              helperText={selectedYearKey ? 'No configured subjects for this year. Enter manually.' : 'Select year first'}
              disabled={!selectedYearKey}
            />
          )}
          {canChooseFromSectionList ? (
            <TextField
              select
              label="Section"
              name="section"
              value={formData.section}
              onChange={handleInputChange}
              required
              fullWidth
            >
              {availableSections.map((section) => (
                <MenuItem key={section} value={section}>{section}</MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Section"
              name="section"
              value={formData.section}
              onChange={handleInputChange}
              required
              fullWidth
              helperText={selectedYearKey ? 'No configured sections for this year. Enter manually.' : 'Select year first'}
              disabled={!selectedYearKey}
            />
          )}
          <TextField
            select
            label="Department"
            name="departmentName"
            value={formData.departmentName}
            onChange={handleInputChange}
            required
            fullWidth
          >
            {departments.length === 0 ? (
              <MenuItem value="" disabled>
                No departments available
              </MenuItem>
            ) : (
              departments.map((departmentName) => (
                <MenuItem key={departmentName} value={departmentName}>{departmentName}</MenuItem>
              ))
            )}
          </TextField>
          <Box sx={{ border: '2px dashed #ccc', p: 2, borderRadius: 1, textAlign: 'center' }}>
            <input
              key={fileInputKey}
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-input"
              required
            />
            <label htmlFor="file-input" style={{ cursor: 'pointer', display: 'block' }}>
              {file ? `Selected: ${file.name}` : 'Click to select file'}
            </label>
          </Box>
          <Button type="submit" variant="contained" color="primary" disabled={loading || !file}>
            {loading ? 'Uploading...' : 'Upload Material'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default UploadMaterials;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const http = require('http');
const https = require('https');
const { cloudinary, uploadBuffer } = require('../config/cloudinary');
const Department = require('../models/Department');
const { verifyToken, requireRole } = require('../middleware/auth');

const upload = multer();

function streamDownloadFromUrl(sourceUrl, res, downloadName, redirectCount = 0) {
  if (redirectCount > 5) {
    res.status(502).json({ message: 'Too many redirects while fetching file' });
    return;
  }

  const client = sourceUrl.startsWith('https') ? https : http;

  function getCloudinaryFallbackUrl(urlValue, filename) {
    try {
      const parsed = new URL(urlValue);
      if (!parsed.hostname.includes('res.cloudinary.com')) return null;

      const match = parsed.pathname.match(/\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
      if (!match) return null;

      const resourceType = match[1];
      const assetPath = match[2];
      const cleanAssetPath = assetPath.replace(/^\/+/, '');

      const lastDot = cleanAssetPath.lastIndexOf('.');
      const hasExt = lastDot > cleanAssetPath.lastIndexOf('/');
      const publicId = hasExt ? cleanAssetPath.slice(0, lastDot) : cleanAssetPath;
      const format = hasExt ? cleanAssetPath.slice(lastDot + 1) : undefined;

      if (!publicId) return null;

      return cloudinary.utils.private_download_url(publicId, format, {
        resource_type: resourceType,
        type: 'upload',
        attachment: filename || 'download',
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60
      });
    } catch (_) {
      return null;
    }
  }

  const request = client.get(sourceUrl, (upstream) => {
    if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
      const nextUrl = new URL(upstream.headers.location, sourceUrl).toString();
      upstream.resume();
      return streamDownloadFromUrl(nextUrl, res, downloadName, redirectCount + 1);
    }

    if (upstream.statusCode !== 200) {
      upstream.resume();
      if (!res.headersSent) {
        const signedUrl = getCloudinaryFallbackUrl(sourceUrl, downloadName);
        return res.redirect(signedUrl || sourceUrl);
      }
      return;
    }

    const safeName = String(downloadName || 'download').replace(/[\r\n"]/g, '');
    const encodedName = encodeURIComponent(safeName);

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`);

    upstream.pipe(res);
  });

  request.on('error', () => {
    if (!res.headersSent) {
      const signedUrl = getCloudinaryFallbackUrl(sourceUrl, downloadName);
      res.redirect(signedUrl || sourceUrl);
    }
  });
}

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Materials route is working ✓' });
});

// Upload material (faculty)
router.post('/upload', verifyToken, requireRole('faculty','admin'), upload.single('file'), async (req, res) => {
  try {
    console.log('\n📤 POST /materials/upload');
    console.log('User:', { role: req.user.role, dept: req.user.department });
    
    if (!req.file) {
      console.error('❌ No file provided');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const { title, subject, departmentName, year, section } = req.body;
    
    console.log('Request data:', { title, subject, departmentName, year, section, fileName: req.file.originalname });
    
    if (!departmentName || !title) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ message: 'Department name and title are required' });
    }

    console.log('🔄 Uploading to Cloudinary...');
    const result = await uploadBuffer(req.file.buffer, { 
      resource_type: 'auto',
      type: 'upload',
      folder: `arh/${departmentName}` 
    });
    
    console.log('✓ Cloudinary upload successful:', result.secure_url);
    
    // Save to department materials (create department if missing)
    console.log('💾 Saving to database...');
    let dept = await Department.findOne({ name: departmentName });
    if (!dept) {
      console.log(`  Creating new department: ${departmentName}`);
      dept = new Department({ name: departmentName, subjects: [], sections: [] });
    }
    
    dept.materials.push({ 
      title: title || req.file.originalname, 
      url: result.secure_url, 
      filename: req.file.originalname, 
      subject: subject || 'Untitled',
      year: Number(year),
      section: String(section).toUpperCase(),
      uploadedBy: req.user._id,
      createdAt: new Date()
    });
    
    await dept.save();
    console.log('✓ Material saved to database');
    
    res.json({ 
      message: 'File uploaded successfully ✓',
      url: result.secure_url 
    });
  } catch (err) { 
    console.error('❌ Upload error:', err.message);
    console.error(err);
    res.status(500).json({ 
      error: err.message,
      details: 'Check server logs for details'
    }); 
  }
});

// Get all materials (for admin/faculty to see all, students see filtered)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('GET /materials - User:', { userId: req.user._id, role: req.user.role, dept: req.user.department, year: req.user.year, section: req.user.section });
    
    const user = req.user;
    
    // For testing: get all materials first
    const departments = await Department.find().lean();
    console.log('Found departments:', departments.length);
    
    let allMaterials = [];
    const normalizedSubjectFilter = String(req.query.subject || '').trim().toLowerCase();
    
    for (let dept of departments) {
      console.log(`Processing dept: ${dept.name}, materials count: ${dept.materials ? dept.materials.length : 0}`);
      
      if (!dept.materials || dept.materials.length === 0) continue;
      
      for (let material of dept.materials) {
        console.log(`Material: ${material.title}, year: ${material.year}, section: ${material.section}`);

        if (normalizedSubjectFilter) {
          const materialSubject = String(material.subject || '').trim().toLowerCase();
          if (materialSubject !== normalizedSubjectFilter) {
            continue;
          }
        }
        
        // Normalize section for comparison
        const materialSection = String(material.section).toUpperCase().trim();
        const userSection = String(user.section).toUpperCase().trim();
        
        // Students see all materials in their department
        if (user.role === 'student') {
          if (dept.name === user.department) {
            console.log(`✓ Adding material for student: ${material.title}`);
            allMaterials.push({
              _id: material._id,
              title: material.title,
              subject: material.subject,
              section: material.section,
              year: material.year,
              fileUrl: material.url,
              fileName: material.filename,
              department: dept.name,
              uploadedBy: { name: 'Faculty' },
              createdAt: material.createdAt
            });
          }
        } 
        // Faculty/Admin see all materials in their department
        else if ((user.role === 'faculty' || user.role === 'admin')) {
          if (dept.name === user.department) {
            console.log(`✓ Adding material for faculty: ${material.title}`);
            allMaterials.push({
              _id: material._id,
              title: material.title,
              subject: material.subject,
              section: material.section,
              year: material.year,
              fileUrl: material.url,
              fileName: material.filename,
              department: dept.name,
              uploadedBy: { name: 'Faculty' },
              createdAt: material.createdAt
            });
          }
        }
      }
    }
    
    console.log(`Returning ${allMaterials.length} materials`);
    res.json(allMaterials);
    
  } catch (err) { 
    console.error('❌ Error fetching materials:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// Download material (auth check + redirect to stored file URL)
router.get('/download/:id', verifyToken, async (req, res) => {
  try {
    console.log('\n📥 GET /materials/download/:id');
    console.log('Material ID:', req.params.id);
    
    const materialId = req.params.id;
    
    // Find the material
    const deptWithMaterial = await Department.findOne(
      { 'materials._id': materialId }
    );
    
    if (!deptWithMaterial) {
      console.log('❌ Material not found');
      return res.status(404).json({ message: 'Material not found' });
    }
    
    const material = deptWithMaterial.materials.find(m => m._id.toString() === materialId);
    
    if (!material) {
      console.log('❌ Material not found in array');
      return res.status(404).json({ message: 'Material not found' });
    }
    
    // Verify auth: student/faculty/admin must be in same department
    if (req.user.role === 'student') {
      if (deptWithMaterial.name !== req.user.department) {
        return res.status(403).json({ message: 'Not authorized to download this material' });
      }
    } else if (req.user.role === 'faculty' || req.user.role === 'admin' || req.user.role === 'hod') {
      if (deptWithMaterial.name !== req.user.department) {
        return res.status(403).json({ message: 'Cannot download material from different department' });
      }
    }
    
    const fileUrl = material.url || material.fileUrl;
    if (!fileUrl) {
      return res.status(404).json({ message: 'File URL not found for this material' });
    }

    const originalName = material.filename || material.fileName || material.title || 'material-file';
    console.log('✓ Auth passed, streaming file with original filename:', originalName);
    return streamDownloadFromUrl(fileUrl, res, originalName);
    
  } catch (err) {
    console.error('❌ Download error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete material (faculty/admin only)
router.delete('/:id', verifyToken, requireRole('faculty', 'admin'), async (req, res) => {
  try {
    console.log('\n🗑️ DELETE /materials/:id');
    console.log('Material ID:', req.params.id);
    console.log('User:', { role: req.user.role, dept: req.user.department });

    const materialId = req.params.id;
    
    // Find the material first to verify it exists
    const deptWithMaterial = await Department.findOne(
      { 'materials._id': materialId },
      { name: 1, 'materials.$': 1 }
    );
    
    console.log('Department with material:', deptWithMaterial ? deptWithMaterial.name : 'NOT FOUND');
    
    if (!deptWithMaterial) {
      console.log('❌ Material not found in any department');
      return res.status(404).json({ message: 'Material not found' });
    }

    // Verify user's department matches
    if (deptWithMaterial.name !== req.user.department) {
      console.log('❌ User department mismatch:', { userDept: req.user.department, materialDept: deptWithMaterial.name });
      return res.status(403).json({ message: 'Cannot delete material from different department' });
    }

    // Now delete it
    const result = await Department.findByIdAndUpdate(
      deptWithMaterial._id,
      { $pull: { materials: { _id: materialId } } },
      { new: true }
    );

    console.log('✓ Material deleted from database');
    res.json({ message: 'Material deleted successfully ✓' });
    
  } catch (err) {
    console.error('❌ Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const Assignment = require('../models/Assignment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const { cloudinary, uploadBuffer } = require('../config/cloudinary');
const { sendReminderEmail } = require('../utils/reminderEmail');

const upload = multer();

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

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

/* ======================================================
   CREATE ASSIGNMENT WITH FILE UPLOAD
====================================================== */
router.post(
  '/upload',
  verifyToken,
  requireRole('faculty', 'admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: 'No file uploaded' });

      const {
        title,
        description,
        department,
        departmentName,
        year,
        section,
        subject,
        dueDate
      } = req.body;

      const targetDepartment = String(department || departmentName || req.user?.department || '').trim()

      if (!targetDepartment || !year || !section) {
        return res.status(400).json({ message: 'Missing required fields: department, year, section' })
      }

      console.log('Creating assignment with file:', { title, subject, department: targetDepartment, year, section });

      const result = await uploadBuffer(req.file.buffer, {
        resource_type: 'auto',
        type: 'upload',
        folder: `arh/assignments/${targetDepartment}`
      });

      const assignment = new Assignment({
        title: title || req.file.originalname,
        description,
        department: targetDepartment,
        year: Number(year),                        // ✅ FIXED
        section: String(section).toUpperCase(),    // ✅ Normalize
        subject,
        dueDate,
        fileUrl: result.secure_url,
        filename: req.file.originalname,
        createdBy: req.user._id
      });

      console.log('Assignment before save:', assignment);
      await assignment.save();
      console.log('Assignment saved successfully:', assignment._id);

      const dueDateText = assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'
      const immediateTitle = 'New Assignment Posted'
      const immediateMessage = `New assignment posted for subject ${assignment.subject || 'N/A'}: ${assignment.title}. Due date: ${dueDateText}.`
      const immediateAlertSummary = {
        totalStudentsMatched: 0,
        notificationsCreated: 0,
        email: {
          sent: 0,
          failed: 0,
          disabled: 0,
          invalid_email: 0,
          skipped_no_email: 0
        }
      }

      try {
        const assignmentDepartment = String(assignment.department || '').trim()
        const assignmentDepartmentRegex = new RegExp(`^${escapeRegExp(assignmentDepartment)}$`, 'i')

        const departmentStudents = await User.find({ role: 'student', department: assignmentDepartmentRegex })
        const assignmentYear = Number(assignment.year)
        const assignmentSection = normalizeText(assignment.section)

        const targetStudents = departmentStudents.filter((student) => {
          return (
            normalizeText(student.department) === normalizeText(assignmentDepartment) &&
            Number(student.year) === assignmentYear &&
            normalizeText(student.section) === assignmentSection
          )
        })

        immediateAlertSummary.totalStudentsMatched = targetStudents.length

        for (const student of targetStudents) {
          const existing = await Notification.findOne({
            user: student._id,
            assignment: assignment._id,
            title: immediateTitle
          })

          if (existing) continue

          const notification = await Notification.create({
            user: student._id,
            assignment: assignment._id,
            title: immediateTitle,
            message: immediateMessage,
            type: 'info',
            department: assignment.department,
            recipientRole: 'student',
            createdBy: req.user._id
          })

          let emailStatus = 'not_attempted'
          let emailError = ''

          if (student.email) {
            try {
              const sendResult = await sendReminderEmail(
                student.email,
                `${immediateTitle}: ${assignment.subject || 'N/A'}`,
                immediateMessage,
                `<p>${immediateMessage}</p>`
              )
              if (sendResult?.sent) {
                emailStatus = 'sent'
                notification.emailSentAt = new Date()
              } else if (sendResult?.reason === 'email_not_configured') {
                emailStatus = 'disabled'
                emailError = 'SMTP email is not configured'
              } else if (sendResult?.reason === 'invalid_email') {
                emailStatus = 'invalid_email'
                emailError = 'Invalid student email format'
              } else {
                emailStatus = 'failed'
                emailError = 'Unknown email send failure'
              }
            } catch (whatsErr) {
              emailStatus = 'failed'
              emailError = whatsErr.message
            }
          } else {
            emailStatus = 'skipped_no_email'
            emailError = 'Student email missing'
          }

          notification.emailStatus = emailStatus
          notification.emailError = emailError
          await notification.save()
          immediateAlertSummary.notificationsCreated += 1

          if (Object.prototype.hasOwnProperty.call(immediateAlertSummary.email, emailStatus)) {
            immediateAlertSummary.email[emailStatus] += 1
          }
        }
      } catch (alertErr) {
        console.error('Immediate assignment alert error:', alertErr.message)
      }

      res.json({ assignment, message: 'Assignment created successfully', immediateAlertsCreated: immediateAlertSummary.notificationsCreated, immediateAlertSummary });

    } catch (err) {
      console.error('Error creating assignment:', err);
      res.status(500).json({ error: err.message });
    }
  }
);


/* ======================================================
   GET ASSIGNMENTS (Role Based + Pagination)
====================================================== */
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    let filter = {};

    console.log('Fetching assignments for user:', { userId: user._id, role: user.role, dept: user.department, year: user.year, section: user.section });

    // 🔹 STUDENT → Dept + Year + Section
    if (user.role === 'student') {
      filter = {
        department: user.department,
        year: Number(user.year),                   // ✅ FIXED
        section: String(user.section).toUpperCase()
      };
    }

    // 🔹 FACULTY → Dept only
    else if (user.role === 'faculty') {
      filter = {
        department: user.department
      };
    }

    // 🔹 ADMIN → All assignments
    else if (user.role === 'admin') {
      filter = {};
    }

    const { subject, page = 1, limit = 20 } = req.query;

    if (subject) {
      filter.subject = subject;
    }

    console.log('Filter applied:', filter);

    const skip = (Number(page) - 1) * Number(limit);

    const assignments = await Assignment.find(filter)
      .sort({ createdAt: -1 })   // Latest first
      .skip(skip)
      .limit(Number(limit))
      .populate('createdBy', 'name email')
      .populate('dueDateUpdatedBy', 'name email');

    const total = await Assignment.countDocuments(filter);

    console.log(`Found ${assignments.length} assignments, total: ${total}`);
    console.log('Assignments:', assignments.map(a => ({ _id: a._id, title: a.title, fileUrl: a.fileUrl })));

    res.json({
      assignments,
      page: Number(page),
      limit: Number(limit),
      total
    });

  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   UPDATE ASSIGNMENT DUE DATE (Faculty/Admin)
====================================================== */
router.put('/:id/due-date', verifyToken, requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const { dueDate } = req.body || {}
    if (!dueDate) {
      return res.status(400).json({ message: 'dueDate is required' })
    }

    const parsedDueDate = new Date(dueDate)
    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ message: 'Invalid dueDate' })
    }

    const assignment = await Assignment.findById(req.params.id)
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }

    if (req.user.role !== 'admin' && assignment.department !== req.user.department) {
      return res.status(403).json({ message: 'Cannot edit assignment from different department' })
    }

    assignment.dueDate = parsedDueDate
    assignment.dueDateUpdatedAt = new Date()
    assignment.dueDateUpdatedBy = req.user._id
    await assignment.save()

    await Notification.deleteMany({
      assignment: assignment._id,
      $or: [
        { reminderStage: { $in: ['DUE_TOMORROW', 'DUE_TODAY'] } },
        { title: { $regex: '^Assignment Reminder - Due (Tomorrow|Today)$', $options: 'i' } }
      ]
    })

    const dueDateText = new Date(assignment.dueDate).toLocaleDateString()
    const syncTitle = 'Assignment Due Date Updated'
    const syncMessage = `Due date updated for ${assignment.title} (${assignment.subject || 'N/A'}). New due date: ${dueDateText}.`
    const syncSummary = {
      totalStudentsMatched: 0,
      notificationsSynced: 0,
      email: {
        sent: 0,
        failed: 0,
        disabled: 0,
        invalid_email: 0,
        skipped_no_email: 0
      }
    }

    const assignmentDepartment = String(assignment.department || '').trim()
    const assignmentDepartmentRegex = new RegExp(`^${escapeRegExp(assignmentDepartment)}$`, 'i')
    const departmentStudents = await User.find({ role: 'student', department: assignmentDepartmentRegex })
    const assignmentYear = Number(assignment.year)
    const assignmentSection = normalizeText(assignment.section)

    const targetStudents = departmentStudents.filter((student) => {
      return (
        normalizeText(student.department) === normalizeText(assignmentDepartment) &&
        Number(student.year) === assignmentYear &&
        normalizeText(student.section) === assignmentSection
      )
    })

    syncSummary.totalStudentsMatched = targetStudents.length

    for (const student of targetStudents) {
      let notification = await Notification.findOne({
        user: student._id,
        assignment: assignment._id,
        title: syncTitle
      })

      if (!notification) {
        notification = await Notification.create({
          user: student._id,
          assignment: assignment._id,
          title: syncTitle,
          message: syncMessage,
          type: 'info',
          department: assignment.department,
          recipientRole: 'student',
          createdBy: req.user._id,
          read: false
        })
      } else {
        notification.message = syncMessage
        notification.read = false
      }

      let emailStatus = 'not_attempted'
      let emailError = ''

      if (student.email) {
        try {
          const sendResult = await sendReminderEmail(
            student.email,
            `${syncTitle}: ${assignment.subject || 'N/A'}`,
            syncMessage,
            `<p>${syncMessage}</p>`
          )
          if (sendResult?.sent) {
            emailStatus = 'sent'
            notification.emailSentAt = new Date()
          } else if (sendResult?.reason === 'email_not_configured') {
            emailStatus = 'disabled'
            emailError = 'SMTP email is not configured'
          } else if (sendResult?.reason === 'invalid_email') {
            emailStatus = 'invalid_email'
            emailError = 'Invalid student email format'
          } else {
            emailStatus = 'failed'
            emailError = 'Unknown email send failure'
          }
        } catch (whatsErr) {
          emailStatus = 'failed'
          emailError = whatsErr.message
        }
      } else {
        emailStatus = 'skipped_no_email'
        emailError = 'Student email missing'
      }

      notification.emailStatus = emailStatus
      notification.emailError = emailError
      await notification.save()

      syncSummary.notificationsSynced += 1
      if (Object.prototype.hasOwnProperty.call(syncSummary.email, emailStatus)) {
        syncSummary.email[emailStatus] += 1
      }
    }

    return res.json({
      message: 'Assignment due date updated successfully',
      assignment,
      syncSummary
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

/* ======================================================
   DOWNLOAD ASSIGNMENT FILE (Role Based)
====================================================== */
router.get('/:id/download', verifyToken, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (!assignment.fileUrl) {
      return res.status(404).json({ message: 'No attachment available for this assignment' });
    }

    if (req.user.role === 'student') {
      const allowed =
        assignment.department === req.user.department &&
        Number(assignment.year) === Number(req.user.year) &&
        String(assignment.section).toUpperCase() === String(req.user.section).toUpperCase();

      if (!allowed) {
        return res.status(403).json({ message: 'Not authorized to download this assignment' });
      }
    } else if (req.user.role === 'faculty') {
      if (assignment.department !== req.user.department) {
        return res.status(403).json({ message: 'Cannot download assignment from different department' });
      }
    }

    const originalName = assignment.filename || assignment.title || 'assignment-file';
    return streamDownloadFromUrl(assignment.fileUrl, res, originalName);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


/* ======================================================
   ACKNOWLEDGE ASSIGNMENT (Student)
====================================================== */
router.post(
  '/:id/acknowledge',
  verifyToken,
  requireRole('student'),
  async (req, res) => {
    try {
      const assignment = await Assignment.findById(req.params.id);

      if (!assignment)
        return res.status(404).json({ message: 'Assignment not found' });

      const allowed =
        assignment.department === req.user.department &&
        Number(assignment.year) === Number(req.user.year) &&
        String(assignment.section).toUpperCase() === String(req.user.section).toUpperCase();

      if (!allowed) {
        return res.status(403).json({ message: 'Not authorized to acknowledge this assignment' });
      }

      const already = assignment.acknowledgements.find(
        a => a.student.toString() === req.user._id.toString()
      );

      if (already)
        return res.status(400).json({ message: 'Already acknowledged' });

      assignment.acknowledgements.push({
        student: req.user._id,
        method: req.body.method || 'online'
      });

      await assignment.save();

      if (assignment.createdBy && assignment.createdBy.toString() !== req.user._id.toString()) {
        const studentName = req.user.name || 'Student';
        const studentYear = req.user.year ?? assignment.year;
        const studentSection = req.user.section || assignment.section || '-';
        const assignmentSubject = assignment.subject || '-';

        await Notification.create({
          user: assignment.createdBy,
          title: 'Assignment Acknowledged',
          message: `Name: ${studentName}, Year: ${studentYear}, Section: ${studentSection}, Subject: ${assignmentSubject}`,
          studentName,
          studentYear: Number(studentYear),
          studentSection,
          subject: assignmentSubject,
          type: 'info',
          assignment: assignment._id,
          department: assignment.department,
          recipientRole: 'faculty',
          createdBy: req.user._id
        });
      }

      res.json({ message: 'Acknowledged successfully' });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);


/* ======================================================
   GET ACKNOWLEDGEMENTS (Faculty/Admin)
====================================================== */
router.get(
  '/:id/acknowledgements',
  verifyToken,
  requireRole('faculty', 'admin'),
  async (req, res) => {
    try {
      const assignment = await Assignment.findById(req.params.id)
        .populate('acknowledgements.student', 'name email');

      if (!assignment)
        return res.status(404).json({ message: 'Assignment not found' });

      res.json({
        acknowledgements: assignment.acknowledgements
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ======================================================
   DELETE ASSIGNMENT (Faculty/Admin)
====================================================== */
router.delete(
  '/:id',
  verifyToken,
  requireRole('faculty', 'admin'),
  async (req, res) => {
    try {
      console.log('\n🗑️ DELETE /assignments/:id');
      console.log('Assignment ID:', req.params.id);
      console.log('User:', { role: req.user.role, dept: req.user.department });

      const assignment = await Assignment.findById(req.params.id);

      if (!assignment) {
        console.log('❌ Assignment not found');
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Check if user is from same department or is admin
      if (req.user.role !== 'admin' && assignment.department !== req.user.department) {
        console.log('❌ Unauthorized: Different department');
        return res.status(403).json({ message: 'Cannot delete assignment from different department' });
      }

      const deletedAssignment = await Assignment.findByIdAndDelete(req.params.id);
      console.log('✓ Assignment deleted:', deletedAssignment.title);

      res.json({ message: 'Assignment deleted successfully ✓', assignment: deletedAssignment });

    } catch (err) {
      console.error('❌ Delete error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;

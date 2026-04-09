const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendReminderEmail } = require('../utils/reminderEmail');
const { logActivity } = require('../utils/activityLogger');
const { toCsv } = require('../utils/csv');

function isWebsiteManager(user) {
  return user?.role === 'admin' && !user?.department
}

function normalizeDepartment(value) {
  return String(value || '').trim().toUpperCase()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isReminderLog(record) {
  const stage = String(record?.reminderStage || '')
  const title = String(record?.title || '')
  return (
    /^DUE_/i.test(stage) ||
    /^Assignment Reminder - Due/i.test(title)
  )
}

// Create and broadcast notification (department admin/HOD, admin, faculty)
router.post('/', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const { title, message, type = 'info', recipientRole = 'all', department, year } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Missing required fields' });

    // Build recipient filter
    let filter = { department: department || req.user.department };
    if (recipientRole !== 'all') filter.role = recipientRole;
    // Filter by year if provided (only meaningful for students)
    const recipientYear = year ? Number(year) : null;
    if (recipientYear) filter.year = recipientYear;

    const recipients = await User.find(filter);

    // Create notification for each recipient
    const notifications = recipients.map(u => ({
      user: u._id,
      title,
      message,
      type,
      recipientRole,
      recipientYear: recipientYear || null,
      department: department || req.user.department,
      createdBy: req.user._id,
      emailStatus: 'not_attempted'
    }));

    const created = await Notification.insertMany(notifications);

    // Also save one for the creator to see in their feed
    const notification = new Notification({
      user: req.user._id,
      title,
      message,
      type,
      recipientRole,
      recipientYear: recipientYear || null,
      department: department || req.user.department,
      createdBy: req.user._id,
      emailStatus: 'not_attempted'
    });
    await notification.save();

    // Send emails asynchronously (don't block the response)
    setImmediate(async () => {
      try {
        for (const notif of created) {
          const user = recipients.find(u => u._id.toString() === notif.user.toString());
          if (!user || !user.email) {
            await Notification.updateOne(
              { _id: notif._id },
              { emailStatus: 'skipped_no_email' }
            );
            continue;
          }

          const emailSubject = title;
          const emailText = message;
          const emailHtml = `<h3>${title}</h3><p>${message.replace(/\n/g, '<br/>')}</p>`;

          const sendResult = await sendReminderEmail(user.email, emailSubject, emailText, emailHtml);

          await Notification.updateOne(
            { _id: notif._id },
            {
              emailStatus: sendResult.sent ? 'sent' : 'failed',
              emailError: sendResult.sent ? null : (sendResult.reason || 'Unknown error'),
              emailSentAt: sendResult.sent ? new Date() : null
            }
          );
        }
      } catch (err) {
        console.error('Error sending notification emails:', err);
      }
    });

    await logActivity({
      actor: req.user,
      action: 'notification_create',
      entityType: 'notification',
      entityId: notification._id,
      summary: `Sent notification "${title}" to ${recipients.length} users`,
      department: department || req.user.department,
      metadata: { recipientRole, recipientYear: recipientYear || null, recipientCount: recipients.length }
    })

    const yearLabel = recipientYear ? ` (Year ${recipientYear})` : '';
    res.json({ notification, message: `Notification sent to ${recipients.length} users${yearLabel}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Send test reminder email to a student
router.post('/test-email', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const { studentId, email, message, subject, dueDate } = req.body || {}

    if (!studentId && !email) {
      return res.status(400).json({ message: 'studentId or email is required' })
    }

    let targetEmail = String(email || '').trim().toLowerCase()
    let student = null

    if (studentId) {
      student = await User.findById(studentId)
      if (!student || student.role !== 'student') {
        return res.status(404).json({ message: 'Student not found' })
      }

      if (!isWebsiteManager(req.user)) {
        if (
          !req.user.department ||
          normalizeDepartment(student.department) !== normalizeDepartment(req.user.department)
        ) {
          return res.status(403).json({ message: 'Cannot send reminder email to student from different department' })
        }
      }

      targetEmail = String(student.email || '').trim().toLowerCase()
    }

    if (!targetEmail) {
      return res.status(400).json({ message: student ? 'Selected student has no email address' : 'Email is required' })
    }

    const dueDateText = dueDate ? new Date(dueDate).toLocaleDateString() : new Date().toLocaleDateString()
    const defaultMessage = `Reminder: Your assignment for subject ${subject || 'N/A'} is due on ${dueDateText}.`
    const finalMessage = String(message || '').trim() || defaultMessage
    const finalSubject = `Assignment Reminder: ${subject || 'N/A'}`

    const sendResult = await sendReminderEmail(targetEmail, finalSubject, finalMessage, `<p>${finalMessage}</p>`)

    if (!sendResult?.sent) {
      const reason = sendResult?.reason || 'unknown'
      if (reason === 'email_not_configured') {
        return res.status(400).json({ message: 'SMTP email is not configured' })
      }
      if (reason === 'invalid_email') {
        return res.status(400).json({ message: 'Invalid email format' })
      }
      return res.status(500).json({ message: 'Failed to send test reminder email' })
    }

    return res.json({
      message: 'Test reminder email sent successfully',
      to: targetEmail,
      student: student
        ? {
            id: student._id,
            name: student.name,
            email: student.email
          }
        : null
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to send test reminder email' })
  }
});

// Reminder delivery logs for faculty/hod/admin
router.get('/reminder-logs', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 20)))
    const status = String(req.query?.status || 'all').trim().toLowerCase()
    const search = String(req.query?.search || '').trim()

    const query = {
      $or: [
        { reminderStage: { $regex: '^DUE_' } },
        { title: { $regex: '^Assignment Reminder - Due', $options: 'i' } }
      ]
    }

    if (status === 'sent') {
      query.emailStatus = 'sent'
    } else if (status === 'failed') {
      query.emailStatus = 'failed'
    }

    if (!isWebsiteManager(req.user)) {
      query.department = new RegExp(`^${normalizeDepartment(req.user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }

    if (search) {
      const escapedSearch = escapeRegex(search)
      query.$and = query.$and || []
      query.$and.push({
        $or: [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { message: { $regex: escapedSearch, $options: 'i' } },
          { subject: { $regex: escapedSearch, $options: 'i' } },
          { studentName: { $regex: escapedSearch, $options: 'i' } },
          { emailError: { $regex: escapedSearch, $options: 'i' } }
        ]
      })
    }

    const total = await Notification.countDocuments(query)

    const logs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email year section department')
      .populate('assignment', 'title subject dueDate year section department')
      .skip((page - 1) * limit)
      .limit(limit)

    return res.json({ logs, page, limit, total })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch reminder logs' })
  }
})

router.get('/reminder-logs/export', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const status = String(req.query?.status || 'all').trim().toLowerCase()
    const search = String(req.query?.search || '').trim()

    const query = {
      $or: [
        { reminderStage: { $regex: '^DUE_' } },
        { title: { $regex: '^Assignment Reminder - Due', $options: 'i' } }
      ]
    }

    if (status === 'sent') {
      query.emailStatus = 'sent'
    } else if (status === 'failed') {
      query.emailStatus = 'failed'
    }

    if (!isWebsiteManager(req.user)) {
      query.department = new RegExp(`^${normalizeDepartment(req.user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }

    if (search) {
      const escapedSearch = escapeRegex(search)
      query.$and = query.$and || []
      query.$and.push({
        $or: [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { message: { $regex: escapedSearch, $options: 'i' } },
          { subject: { $regex: escapedSearch, $options: 'i' } },
          { studentName: { $regex: escapedSearch, $options: 'i' } },
          { emailError: { $regex: escapedSearch, $options: 'i' } }
        ]
      })
    }

    const logs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email year section department')
      .populate('assignment', 'title subject dueDate year section department')

    const csv = toCsv(logs, [
      { key: 'createdAt', label: 'Created At', value: (row) => new Date(row.createdAt).toLocaleString() },
      { key: 'student', label: 'Student', value: (row) => row.user?.name || row.studentName || '-' },
      { key: 'subject', label: 'Subject', value: (row) => row.assignment?.subject || row.subject || '-' },
      { key: 'stage', label: 'Stage', value: (row) => row.reminderStage || '-' },
      { key: 'emailStatus', label: 'Email Status' },
      { key: 'emailSentAt', label: 'Email Sent At', value: (row) => row.emailSentAt ? new Date(row.emailSentAt).toLocaleString() : '-' },
      { key: 'emailError', label: 'Error' },
      { key: 'department', label: 'Department' }
    ])

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="reminder-logs.csv"')
    res.send(csv)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to export reminder logs' })
  }
})

// Delete one reminder log (faculty/hod/admin)
router.delete('/reminder-logs/:id', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const reminderLog = await Notification.findById(req.params.id)

    if (!reminderLog) {
      return res.status(404).json({ message: 'Reminder log not found' })
    }

    if (!isReminderLog(reminderLog)) {
      return res.status(400).json({ message: 'Selected notification is not a reminder log' })
    }

    if (!isWebsiteManager(req.user)) {
      if (normalizeDepartment(reminderLog.department) !== normalizeDepartment(req.user.department)) {
        return res.status(403).json({ message: 'Cannot delete reminder logs from different department' })
      }
    }

    await Notification.findByIdAndDelete(reminderLog._id)

    await logActivity({
      actor: req.user,
      action: 'reminder_log_delete',
      entityType: 'notification',
      entityId: reminderLog._id,
      summary: `Deleted reminder log ${reminderLog.title}`,
      department: reminderLog.department,
      metadata: { reminderStage: reminderLog.reminderStage, subject: reminderLog.subject }
    })

    return res.json({ message: 'Reminder log deleted successfully' })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete reminder log' })
  }
})

// Delete all reminder logs in user scope (faculty/hod/admin)
router.delete('/reminder-logs', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const query = {
      $or: [
        { reminderStage: { $regex: '^DUE_' } },
        { title: { $regex: '^Assignment Reminder - Due', $options: 'i' } }
      ]
    }

    if (!isWebsiteManager(req.user)) {
      query.department = new RegExp(`^${normalizeDepartment(req.user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }

    const result = await Notification.deleteMany(query)

    await logActivity({
      actor: req.user,
      action: 'reminder_log_delete_all',
      entityType: 'notification',
      summary: `Deleted ${result.deletedCount || 0} reminder logs`,
      department: req.user.department,
      metadata: { deletedCount: result.deletedCount || 0 }
    })
    return res.json({ message: 'All reminder logs deleted successfully', deletedCount: result.deletedCount || 0 })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to delete reminder logs' })
  }
})

// Get notifications for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim()
    const type = String(req.query?.type || '').trim().toLowerCase()
    const read = String(req.query?.read || '').trim().toLowerCase()

    const query = { user: req.user._id }

    if (type) {
      query.type = type
    }

    if (read === 'read') {
      query.read = true
    } else if (read === 'unread') {
      query.read = false
    }

    if (search) {
      const escapedSearch = escapeRegex(search)
      query.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { message: { $regex: escapedSearch, $options: 'i' } },
        { recipientRole: { $regex: escapedSearch, $options: 'i' } },
        { department: { $regex: escapedSearch, $options: 'i' } }
      ]
    }

    const notes = await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('assignment', 'year section subject title')
      .limit(100);
    res.json({ notifications: notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export', verifyToken, async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim()
    const type = String(req.query?.type || '').trim().toLowerCase()
    const read = String(req.query?.read || '').trim().toLowerCase()

    const query = { user: req.user._id }

    if (type) {
      query.type = type
    }

    if (read === 'read') {
      query.read = true
    } else if (read === 'unread') {
      query.read = false
    }

    if (search) {
      const escapedSearch = escapeRegex(search)
      query.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { message: { $regex: escapedSearch, $options: 'i' } },
        { recipientRole: { $regex: escapedSearch, $options: 'i' } },
        { department: { $regex: escapedSearch, $options: 'i' } }
      ]
    }

    const notes = await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('assignment', 'year section subject title')

    const csv = toCsv(notes, [
      { key: 'createdAt', label: 'Date', value: (row) => new Date(row.createdAt).toLocaleString() },
      { key: 'title', label: 'Title' },
      { key: 'message', label: 'Message' },
      { key: 'type', label: 'Type' },
      { key: 'recipientRole', label: 'Recipient Role' },
      { key: 'recipientYear', label: 'Recipient Year' },
      { key: 'department', label: 'Department' },
      { key: 'read', label: 'Read', value: (row) => (row.read ? 'Yes' : 'No') },
      { key: 'emailStatus', label: 'Email Status' }
    ])

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="notifications.csv"')
    res.send(csv)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to export notifications' })
  }
})

// Mark notification read
router.post('/:id/read', verifyToken, async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
    if (!n) return res.status(404).json({ message: 'Not found' });
    res.json({ notification: n });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete notification (department admin/HOD, admin, or creator only)
router.delete('/:id', verifyToken, requireRole('hod', 'admin', 'faculty'), async (req, res) => {
  try {
    const n = await Notification.findById(req.params.id);
    if (!n) return res.status(404).json({ message: 'Not found' });
    const isOwner = n.user && n.user.toString() === req.user._id.toString()
    const isCreator = n.createdBy && n.createdBy.toString() === req.user._id.toString()
    const isPrivileged = req.user.role === 'admin' || req.user.role === 'hod'

    if (!isOwner && !isCreator && !isPrivileged) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Notification.findByIdAndDelete(req.params.id)

    await logActivity({
      actor: req.user,
      action: 'notification_delete',
      entityType: 'notification',
      entityId: n._id,
      summary: `Deleted notification ${n.title}`,
      department: n.department,
      metadata: { recipientRole: n.recipientRole, recipientYear: n.recipientYear }
    })
    res.json({ message: 'Notification deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

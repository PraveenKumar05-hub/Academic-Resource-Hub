const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

function isWebsiteManager(user) {
  return user?.role === 'admin' && !user?.department
}

// Create and broadcast notification (department admin/HOD, admin, faculty)
router.post('/', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const { title, message, type = 'info', recipientRole = 'all', department } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Missing required fields' });

    // Find all recipient users
    let filter = { department: department || req.user.department };
    if (recipientRole !== 'all') filter.role = recipientRole;

    const recipients = await User.find(filter);
    
    // Create notification for each recipient
    const notifications = recipients.map(user => ({
      user: user._id,
      title,
      message,
      type,
      recipientRole,
      department: department || req.user.department,
      createdBy: req.user._id
    }));

    const created = await Notification.insertMany(notifications);
    
    // Also save one for the creator to see in their feed
    const notification = new Notification({
      user: req.user._id,
      title,
      message,
      type,
      recipientRole,
      department: department || req.user.department,
      createdBy: req.user._id
    });
    await notification.save();

    res.json({ notification, message: `Notification sent to ${recipients.length} users` });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
});

// Send test WhatsApp reminder to a student
router.post('/test-whatsapp', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const { studentId, message, subject, dueDate } = req.body || {}

    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required' })
    }

    const student = await User.findById(studentId)
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' })
    }

    if (!isWebsiteManager(req.user)) {
      if (!req.user.department || student.department !== req.user.department) {
        return res.status(403).json({ message: 'Cannot send WhatsApp to student from different department' })
      }
    }

    if (!student.phone) {
      return res.status(400).json({ message: 'Selected student has no phone number' })
    }

    const dueDateText = dueDate ? new Date(dueDate).toLocaleDateString() : new Date().toLocaleDateString()
    const defaultMessage = `Reminder: Your assignment for subject ${subject || 'N/A'} is due on ${dueDateText}.`
    const finalMessage = String(message || '').trim() || defaultMessage

    const sendResult = await sendWhatsAppMessage(student.phone, finalMessage)

    return res.json({
      message: 'Test WhatsApp sent successfully',
      to: student.phone,
      twilio: {
        sid: sendResult?.sid,
        status: sendResult?.status,
        from: sendResult?.from,
        to: sendResult?.to
      },
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone
      }
    })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to send test WhatsApp' })
  }
});

// Reminder delivery logs for faculty/hod/admin
router.get('/reminder-logs', verifyToken, requireRole('faculty', 'hod', 'admin'), async (req, res) => {
  try {
    const query = {
      reminderStage: { $in: ['DUE_TOMORROW', 'DUE_TODAY'] },
      recipientRole: 'student'
    }

    if (!isWebsiteManager(req.user)) {
      query.department = req.user.department
    }

    const logs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone year section department')
      .populate('assignment', 'title subject dueDate year section department')
      .limit(300)

    return res.json({ logs })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch reminder logs' })
  }
})

// Get notifications for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const notes = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('assignment', 'year section subject title')
      .limit(100);
    res.json({ notifications: notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
    res.json({ message: 'Notification deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

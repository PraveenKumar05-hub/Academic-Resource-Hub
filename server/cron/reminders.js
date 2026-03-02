const cron = require('node-cron');
const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

function dateKeyInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(new Date(date))
}

function reminderStageForDueDate(dueDate, now = new Date(), timezone = 'Asia/Kolkata') {
  if (!dueDate) return null

  const dueKey = dateKeyInTimezone(dueDate, timezone)
  const todayKey = dateKeyInTimezone(now, timezone)
  const tomorrowKey = dateKeyInTimezone(new Date(now.getTime() + 24 * 60 * 60 * 1000), timezone)

  if (dueKey === tomorrowKey) {
    return 'DUE_TOMORROW'
  }

  if (dueKey === todayKey) {
    return 'DUE_TODAY'
  }

  return null
}

function reminderTitleAndMessage(assignment, stage) {
  const dueDateText = assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'
  const subjectText = assignment?.subject || 'N/A'

  if (stage === 'DUE_TOMORROW') {
    return {
      title: 'Assignment Reminder - Due Tomorrow',
      message: `Reminder: Your assignment for subject ${subjectText} is due tomorrow (${dueDateText}).`
    }
  }

  return {
    title: 'Assignment Reminder - Due Today',
    message: `Reminder: Your assignment for subject ${subjectText} is due today (${dueDateText}).`
  }
}

module.exports = function startCron() {
  const timezone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'

  const runReminderJob = async () => {
    try {
      console.log('[cron] reminders job started');

      const now = new Date();

      // Cleanup: remove reminder logs once assignment due date has passed
      const existingReminderLogs = await Notification.find({
        reminderStage: { $in: ['DUE_TOMORROW', 'DUE_TODAY'] },
        reminderDueDate: { $exists: true, $ne: null }
      }).select('_id reminderDueDate')

      const expiredIds = existingReminderLogs
        .filter((item) => !reminderStageForDueDate(item.reminderDueDate, now, timezone))
        .map((item) => item._id)

      if (expiredIds.length > 0) {
        await Notification.deleteMany({ _id: { $in: expiredIds } })
        console.log(`[cron] cleaned ${expiredIds.length} expired reminder logs`)
      }

      const assignments = await Assignment.find({
        dueDate: { $exists: true, $ne: null }
      });

      console.log(`[cron] assignments with dueDate found: ${assignments.length}`)

      for (const a of assignments) {
        const stage = reminderStageForDueDate(a.dueDate, now, timezone)
        if (!stage) continue

        const reminderText = reminderTitleAndMessage(a, stage)

        // Find students by department first, then normalize year/section matching
        const departmentStudents = await User.find({ role: 'student', department: a.department });
        const assignmentYear = Number(a.year)
        const assignmentSection = String(a.section || '').trim().toUpperCase()

        const students = departmentStudents.filter((student) => {
          const studentYear = Number(student.year)
          const studentSection = String(student.section || '').trim().toUpperCase()
          return studentYear === assignmentYear && studentSection === assignmentSection
        })

        if (students.length === 0) {
          console.log(`[cron] no students matched for assignment ${a._id} (${a.department} Y${assignmentYear} ${assignmentSection})`)
          continue
        }

        console.log(`[cron] matched ${students.length} students for assignment ${a._id} (${stage})`)

        for (const s of students) {
          // avoid duplicate reminder for same assignment/user/stage
          const exists = await Notification.findOne({
            user: s._id,
            assignment: a._id,
            title: reminderText.title
          });

          if (!exists) {
            const notification = await Notification.create({
              user: s._id,
              assignment: a._id,
              title: reminderText.title,
              message: reminderText.message,
              reminderStage: stage,
              reminderDueDate: a.dueDate,
              type: 'info',
              department: a.department,
              recipientRole: 'student',
              createdBy: a.createdBy
            });

            let whatsappStatus = 'not_attempted'
            let whatsappError = ''

            if (s.phone) {
              const whatsappBody = `${reminderText.message}\nSubject: ${a.subject || 'N/A'}\nAssignment: ${a.title}`
              try {
                const sendResult = await sendWhatsAppMessage(s.phone, whatsappBody)
                if (sendResult?.sent) {
                  whatsappStatus = 'sent'
                  notification.whatsappSentAt = new Date()
                  console.log(`[cron] WhatsApp reminder sent to ${s.email}`)
                } else {
                  if (sendResult?.reason === 'twilio_not_configured') {
                    whatsappStatus = 'disabled'
                    whatsappError = 'Twilio WhatsApp is not configured'
                  } else if (sendResult?.reason === 'invalid_phone') {
                    whatsappStatus = 'invalid_phone'
                    whatsappError = 'Invalid student phone number format'
                  } else {
                    whatsappStatus = 'failed'
                    whatsappError = 'Unknown WhatsApp send failure'
                  }
                }
              } catch (whatsErr) {
                whatsappStatus = 'failed'
                whatsappError = whatsErr.message
                console.error(`[cron] WhatsApp send failed for ${s.email}:`, whatsErr.message)
              }
            } else {
              whatsappStatus = 'skipped_no_phone'
              whatsappError = 'Student phone missing'
              console.log(`[cron] Student phone missing, skipping WhatsApp for ${s.email}`)
            }

            notification.whatsappStatus = whatsappStatus
            notification.whatsappError = whatsappError
            await notification.save()

            console.log(`[cron] reminder notification created for ${s.email} - ${a.title} (${stage})`);
          }
        }
      }
    } catch (err) {
      console.error('[cron] error', err);
    }
  }

  // Run once on server startup so reminders start automatically without waiting for the next schedule tick
  runReminderJob()

  // Run every 5 minutes to auto-send due reminders quickly
  cron.schedule('*/5 * * * *', runReminderJob, { timezone })
};

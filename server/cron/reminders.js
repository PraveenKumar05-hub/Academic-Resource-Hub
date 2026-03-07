const cron = require('node-cron');
const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendReminderEmail } = require('../utils/reminderEmail');

function dateKeyInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(new Date(date))
}

function dayIndexFromDateKey(key) {
  const [year, month, day] = String(key || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return Math.floor(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000))
}

function getReminderLeadDays() {
  const raw = String(process.env.REMINDER_LEAD_DAYS || '2,1,0')
  const values = raw
    .split(',')
    .map((part) => Number(String(part).trim()))
    .filter((num) => Number.isInteger(num) && num >= 0 && num <= 30)

  if (values.length === 0) {
    return [2, 1, 0]
  }

  return [...new Set(values)].sort((a, b) => b - a)
}

function reminderStageForOffset(daysUntilDueDate) {
  if (daysUntilDueDate === 0) return 'DUE_TODAY'
  if (daysUntilDueDate === 1) return 'DUE_TOMORROW'
  return `DUE_IN_${daysUntilDueDate}_DAYS`
}

function reminderStageForDueDate(dueDate, now = new Date(), timezone = 'Asia/Kolkata', reminderLeadDays = [2, 1, 0]) {
  if (!dueDate) return null

  const dueKey = dateKeyInTimezone(dueDate, timezone)
  const todayKey = dateKeyInTimezone(now, timezone)
  const dueIndex = dayIndexFromDateKey(dueKey)
  const todayIndex = dayIndexFromDateKey(todayKey)

  if (dueIndex == null || todayIndex == null) return null

  const daysUntilDueDate = dueIndex - todayIndex
  if (!reminderLeadDays.includes(daysUntilDueDate)) {
    return null
  }

  return reminderStageForOffset(daysUntilDueDate)
}

function reminderTitleAndMessage(assignment, stage) {
  const dueDateText = assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'
  const subjectText = assignment?.subject || 'N/A'
  const classText = `${assignment?.department || 'N/A'} - Year ${assignment?.year || '-'} Section ${assignment?.section || '-'}`

  if (stage === 'DUE_TODAY') {
    return {
      title: 'Assignment Reminder - Due Today',
      message: `Reminder: Your class assignment for ${classText} in subject ${subjectText} is due today (${dueDateText}).`
    }
  }

  if (stage === 'DUE_TOMORROW') {
    return {
      title: 'Assignment Reminder - Due Tomorrow',
      message: `Reminder: Your class assignment for ${classText} in subject ${subjectText} is due tomorrow (${dueDateText}).`
    }
  }

  const match = String(stage || '').match(/^DUE_IN_(\d+)_DAYS$/)
  const days = match ? Number(match[1]) : null

  if (Number.isInteger(days) && days > 1) {
    return {
      title: `Assignment Reminder - Due in ${days} Days`,
      message: `Reminder: Your class assignment for ${classText} in subject ${subjectText} is due in ${days} days (${dueDateText}).`
    }
  }

  return {
    title: 'Assignment Reminder - Due Today',
    message: `Reminder: Your class assignment for ${classText} in subject ${subjectText} is due today (${dueDateText}).`
  }
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase()
}

function isDueDateExpired(dueDate, now = new Date(), timezone = 'Asia/Kolkata') {
  if (!dueDate) return false
  const dueKey = dateKeyInTimezone(dueDate, timezone)
  const todayKey = dateKeyInTimezone(now, timezone)
  return dueKey < todayKey
}

module.exports = function startCron() {
  const timezone = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata'
  const reminderLeadDays = getReminderLeadDays()

  const runReminderJob = async () => {
    try {
      console.log('[cron] reminders job started');

      const now = new Date();

      // Cleanup: remove reminder logs once assignment due date has passed
      const existingReminderLogs = await Notification.find({
        $or: [
          { reminderStage: { $regex: '^DUE_' } },
          { title: { $regex: '^Assignment Reminder - Due', $options: 'i' } }
        ]
      })
        .select('_id reminderDueDate assignment title reminderStage createdAt')
        .populate('assignment', 'dueDate')

      const expiredIds = existingReminderLogs
        .filter((item) => {
          const dueDate = item.reminderDueDate || item.assignment?.dueDate
          return isDueDateExpired(dueDate, now, timezone)
        })
        .map((item) => item._id)

      // Legacy cleanup: if due date metadata is missing, remove once record date is before today
      const todayKey = dateKeyInTimezone(now, timezone)
      const legacyIds = existingReminderLogs
        .filter((item) => {
          const hasDueDate = Boolean(item.reminderDueDate || item.assignment?.dueDate)
          if (hasDueDate || !item.createdAt) return false
          const createdKey = dateKeyInTimezone(item.createdAt, timezone)
          return createdKey < todayKey
        })
        .map((item) => item._id)

      const idsToDelete = [...new Set([...expiredIds, ...legacyIds].map((id) => id.toString()))]

      if (idsToDelete.length > 0) {
        await Notification.deleteMany({ _id: { $in: idsToDelete } })
        console.log(`[cron] cleaned ${idsToDelete.length} expired reminder logs`)
      }

      const assignments = await Assignment.find({
        dueDate: { $exists: true, $ne: null }
      });

      console.log(`[cron] assignments with dueDate found: ${assignments.length}`)

      for (const a of assignments) {
        const stage = reminderStageForDueDate(a.dueDate, now, timezone, reminderLeadDays)
        if (!stage) continue

        if (!a.department || a.year == null || !a.section) {
          console.log(`[cron] skipping assignment ${a._id} due to missing class targeting fields`)
          continue
        }

        const reminderText = reminderTitleAndMessage(a, stage)

        const assignmentDepartment = String(a.department || '').trim()
        const assignmentDepartmentRegex = new RegExp(`^${assignmentDepartment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')

        // Find students by department first (case/space tolerant), then normalize year/section matching
        const departmentStudents = await User.find({
          role: 'student',
          department: assignmentDepartmentRegex
        });
        const assignmentYear = Number(a.year)
        const assignmentSection = normalizeText(a.section)

        const students = departmentStudents.filter((student) => {
          const studentYear = Number(student.year)
          const studentSection = normalizeText(student.section)
          const studentDepartment = normalizeText(student.department)
          return (
            studentDepartment === normalizeText(assignmentDepartment) &&
            studentYear === assignmentYear &&
            studentSection === assignmentSection
          )
        })

        if (students.length === 0) {
          console.log(`[cron] no students matched for assignment ${a._id} (${a.department} Y${assignmentYear} ${assignmentSection})`)
          continue
        }

        console.log(`[cron] matched ${students.length} students for assignment ${a._id} (${stage})`)

        for (const s of students) {
          // get reminder notification for same assignment/user/stage
          let notification = await Notification.findOne({
            user: s._id,
            assignment: a._id,
            title: reminderText.title
          });

          if (!notification) {
            notification = await Notification.create({
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

            console.log(`[cron] reminder notification created for ${s.email} - ${a.title} (${stage})`);
          }

          // retry sending reminder email until successfully sent
          if (notification.emailStatus === 'sent') {
            continue
          }

          let emailStatus = notification.emailStatus || 'not_attempted'
          let emailError = notification.emailError || ''

          if (s.email) {
            const emailSubject = `${reminderText.title}: ${a.subject || 'N/A'}`
            const emailBody = `${reminderText.message}\nAssignment: ${a.title}`
            try {
              const sendResult = await sendReminderEmail(
                s.email,
                emailSubject,
                emailBody,
                `<p>${reminderText.message}</p><p><strong>Assignment:</strong> ${a.title}</p>`
              )
              if (sendResult?.sent) {
                emailStatus = 'sent'
                emailError = ''
                notification.emailSentAt = new Date()
                console.log(`[cron] reminder email sent to ${s.email}`)
              } else {
                if (sendResult?.reason === 'email_not_configured') {
                  emailStatus = 'disabled'
                  emailError = 'SMTP email is not configured'
                } else if (sendResult?.reason === 'invalid_email') {
                  emailStatus = 'invalid_email'
                  emailError = 'Invalid student email format'
                } else {
                  emailStatus = 'failed'
                  emailError = 'Unknown email send failure'
                }
              }
            } catch (whatsErr) {
              emailStatus = 'failed'
              emailError = whatsErr.message
              console.error(`[cron] reminder email send failed for ${s.email}:`, whatsErr.message)
            }
          } else {
            emailStatus = 'skipped_no_email'
            emailError = 'Student email missing'
            console.log(`[cron] Student email missing, skipping reminder for user ${s._id}`)
          }

          notification.emailStatus = emailStatus
          notification.emailError = emailError
          await notification.save()

          console.log(`[cron] reminder notification updated for ${s.email} - ${a.title} (${stage})`)
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

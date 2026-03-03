const nodemailer = require('nodemailer')

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
}

function createTransporter() {
  if (!isEmailConfigured()) return null

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
}

async function sendReminderEmail(to, subject, text, html) {
  const transporter = createTransporter()
  if (!transporter) {
    return { sent: false, reason: 'email_not_configured' }
  }

  const recipient = String(to || '').trim()
  if (!recipient) {
    return { sent: false, reason: 'invalid_email' }
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    subject,
    text,
    html: html || `<p>${String(text || '').replace(/\n/g, '<br/>')}</p>`
  })

  return { sent: true, to: recipient }
}

module.exports = {
  sendReminderEmail,
  isEmailConfigured
}

const axios = require('axios')

function normalizeWhatsAppNumber(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('whatsapp:')) return raw

  const digitsWithPlus = raw.replace(/[^\d+]/g, '')
  if (!digitsWithPlus) return null

  const normalized = digitsWithPlus.startsWith('+') ? digitsWithPlus : `+${digitsWithPlus}`
  return `whatsapp:${normalized}`
}

function isWhatsAppConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  )
}

async function sendWhatsAppMessage(phone, text) {
  if (!isWhatsAppConfigured()) {
    return { sent: false, reason: 'twilio_not_configured' }
  }

  const to = normalizeWhatsAppNumber(phone)
  if (!to) {
    return { sent: false, reason: 'invalid_phone' }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = String(process.env.TWILIO_WHATSAPP_FROM || '').trim()

  const payload = new URLSearchParams()
  payload.append('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`)
  payload.append('To', to)
  payload.append('Body', text)

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`

  try {
    const response = await axios.post(url, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: {
        username: sid,
        password: token
      }
    })

    return {
      sent: true,
      sid: response?.data?.sid,
      status: response?.data?.status,
      to: response?.data?.to,
      from: response?.data?.from
    }
  } catch (error) {
    const twilioMessage = error?.response?.data?.message
    const twilioCode = error?.response?.data?.code
    const detail = twilioMessage
      ? `Twilio error${twilioCode ? ` ${twilioCode}` : ''}: ${twilioMessage}`
      : error.message
    throw new Error(detail)
  }
}

module.exports = {
  sendWhatsAppMessage,
  normalizeWhatsAppNumber,
  isWhatsAppConfigured
}

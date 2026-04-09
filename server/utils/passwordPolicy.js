function validatePasswordStrength(password) {
  const value = String(password || '')
  const issues = []

  if (value.length < 8) {
    issues.push('at least 8 characters')
  }
  if (!/[a-z]/.test(value)) {
    issues.push('one lowercase letter')
  }
  if (!/[A-Z]/.test(value)) {
    issues.push('one uppercase letter')
  }
  if (!/[0-9]/.test(value)) {
    issues.push('one number')
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    issues.push('one special character')
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

function getPasswordStrengthMessage(password) {
  const result = validatePasswordStrength(password)
  if (result.valid) {
    return ''
  }

  return `Password must contain ${result.issues.join(', ')}.`
}

module.exports = {
  validatePasswordStrength,
  getPasswordStrengthMessage
}
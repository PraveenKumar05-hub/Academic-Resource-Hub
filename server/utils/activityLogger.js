const ActivityLog = require('../models/ActivityLog')

async function logActivity({ actor, action, entityType, entityId, summary, department, metadata }) {
  if (!action || !entityType || !summary) {
    return null
  }

  try {
    return await ActivityLog.create({
      actor: actor?._id || actor || null,
      action,
      entityType,
      entityId,
      summary,
      department,
      metadata
    })
  } catch (err) {
    console.error('Failed to write activity log:', err.message)
    return null
  }
}

module.exports = {
  logActivity
}
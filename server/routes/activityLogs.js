const express = require('express')
const router = express.Router()
const ActivityLog = require('../models/ActivityLog')
const { verifyToken, requireRole } = require('../middleware/auth')
const { toCsv } = require('../utils/csv')

function isWebsiteManager(user) {
  return user?.role === 'admin' && !user?.department
}

function normalizeDepartment(value) {
  return String(value || '').trim().toUpperCase()
}

router.get('/', verifyToken, requireRole('admin', 'hod', 'faculty'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 20)))
    const search = String(req.query?.search || '').trim()
    const action = String(req.query?.action || '').trim()
    const entityType = String(req.query?.entityType || '').trim()

    const query = {}

    if (!isWebsiteManager(req.user)) {
      query.department = new RegExp(`^${normalizeDepartment(req.user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }

    if (action) {
      query.action = new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }

    if (entityType) {
      query.entityType = new RegExp(entityType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }

    if (search) {
      query.$or = [
        { summary: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { action: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { entityType: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ]
    }

    const total = await ActivityLog.countDocuments(query)
    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .populate('actor', 'name email role department')
      .skip((page - 1) * limit)
      .limit(limit)

    res.json({ logs, page, limit, total })
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch activity logs' })
  }
})

router.get('/export', verifyToken, requireRole('admin', 'hod', 'faculty'), async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim()
    const action = String(req.query?.action || '').trim()
    const entityType = String(req.query?.entityType || '').trim()

    const query = {}
    if (!isWebsiteManager(req.user)) {
      query.department = new RegExp(`^${normalizeDepartment(req.user.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
    if (action) {
      query.action = new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }
    if (entityType) {
      query.entityType = new RegExp(entityType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }
    if (search) {
      query.$or = [
        { summary: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { action: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { entityType: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ]
    }

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .populate('actor', 'name email role department')

    const csv = toCsv(logs, [
      { key: 'createdAt', label: 'Date', value: (row) => new Date(row.createdAt).toLocaleString() },
      { key: 'action', label: 'Action' },
      { key: 'entityType', label: 'Entity Type' },
      { key: 'summary', label: 'Summary' },
      { key: 'department', label: 'Department' },
      { key: 'actor', label: 'Actor', value: (row) => row.actor ? `${row.actor.name} (${row.actor.email})` : '-' }
    ])

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="activity-logs.csv"')
    res.send(csv)
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to export activity logs' })
  }
})

module.exports = router
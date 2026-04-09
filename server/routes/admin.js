const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Department = require('../models/Department')
const { verifyToken, requireRole } = require('../middleware/auth')
const { toCsv } = require('../utils/csv')
const { logActivity } = require('../utils/activityLogger')

function isWebsiteManager(user) {
  return user?.role === 'admin' && !user?.department
}

function isDepartmentAdmin(user) {
  return user?.role === 'hod' || (user?.role === 'admin' && !!user?.department)
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * ============================================
 * CREATE USER 
 * - Admin: can create users for their department
 * - Faculty: can create students for their department
 * ============================================
 */
router.post(
  '/users',
  verifyToken,
  requireRole('admin', 'hod', 'faculty'),
  async (req, res) => {
    try {
      const { name, email, password, role, phone, year, section, batch, department } = req.body

      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Missing required fields' })
      }

      if (role === 'student' && !String(batch || '').trim()) {
        return res.status(400).json({ message: 'Academic batch is required for students' })
      }

      // Faculty can only create students
      if (req.user.role === 'faculty' && role !== 'student') {
        return res.status(403).json({ message: 'Faculty can only create student accounts' })
      }

      // Department admin can create faculty/students only within their department
      if (isDepartmentAdmin(req.user) && !['faculty', 'student'].includes(role)) {
        return res.status(403).json({ message: 'Department admin can only create faculty or student accounts' })
      }

      const existing = await User.findOne({ email })
      if (existing) {
        return res.status(400).json({ message: 'Email already exists' })
      }

      const hash = await bcrypt.hash(password, 10)

      const targetDepartment = isWebsiteManager(req.user)
        ? (department || req.user.department)
        : req.user.department

      if (!targetDepartment) {
        return res.status(400).json({ message: 'Department is required' })
      }

      const user = new User({
        name,
        email,
        password: hash,
        role,
        phone: String(phone || '').trim(),
        department: targetDepartment,
        year,
        section,
        batch
      })

      await user.save()

      await logActivity({
        actor: req.user,
        action: 'user_create',
        entityType: 'user',
        entityId: user._id,
        summary: `Created ${role} account for ${name}`,
        department: user.department,
        metadata: { email: user.email, role: user.role }
      })

      res.status(201).json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          department: user.department,
          year: user.year,
          section: user.section,
          batch: user.batch
        }
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * ============================================
 * BULK CREATE USERS
 * - Accepts an array of users
 * - Supports defaultPassword for rows that omit password
 * - Returns created/skipped/failed summary
 * ============================================
 */
router.post(
  '/users/bulk',
  verifyToken,
  requireRole('admin', 'hod', 'faculty'),
  async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.users) ? req.body.users : []
      const defaultPassword = String(req.body?.defaultPassword || '').trim()
      const requestDepartment = String(req.body?.department || '').trim()

      if (rows.length === 0) {
        return res.status(400).json({ message: 'users array is required' })
      }

      const normalizedRows = rows.map((row, index) => ({
        rowNumber: index + 2,
        name: String(row?.name || '').trim(),
        email: String(row?.email || '').trim().toLowerCase(),
        password: String(row?.password || '').trim(),
        role: String(row?.role || '').trim().toLowerCase(),
        phone: String(row?.phone || '').trim(),
        year: row?.year === '' || row?.year == null ? undefined : Number(row?.year),
        section: String(row?.section || '').trim(),
        batch: String(row?.batch || '').trim(),
        department: String(row?.department || '').trim()
      }))

      const incomingEmails = Array.from(
        new Set(
          normalizedRows
            .map((row) => row.email)
            .filter(Boolean)
        )
      )

      const existingUsers = incomingEmails.length
        ? await User.find({ email: { $in: incomingEmails } }).select('email')
        : []
      const existingEmailSet = new Set(existingUsers.map((user) => String(user.email || '').toLowerCase()))

      const createdUsers = []
      const skipped = []
      const failed = []

      for (const row of normalizedRows) {
        const {
          rowNumber,
          name,
          email,
          password,
          role,
          phone,
          year,
          section,
          batch,
          department
        } = row

        if (!name || !email || !role) {
          failed.push({ row: rowNumber, reason: 'name, email and role are required' })
          continue
        }

        if (!['student', 'faculty', 'admin', 'hod'].includes(role)) {
          failed.push({ row: rowNumber, reason: `invalid role: ${role}` })
          continue
        }

        if (req.user.role === 'faculty' && role !== 'student') {
          failed.push({ row: rowNumber, reason: 'faculty can only create student accounts' })
          continue
        }

        if (isDepartmentAdmin(req.user) && !['faculty', 'student'].includes(role)) {
          failed.push({ row: rowNumber, reason: 'department admin can only create faculty or student accounts' })
          continue
        }

        if (role === 'student' && !String(batch || '').trim()) {
          failed.push({ row: rowNumber, reason: 'academic batch is required for students' })
          continue
        }

        if (existingEmailSet.has(email)) {
          skipped.push({ row: rowNumber, email, reason: 'email already exists' })
          continue
        }

        const finalPassword = password || defaultPassword
        if (!finalPassword) {
          failed.push({ row: rowNumber, reason: 'password missing (provide password or defaultPassword)' })
          continue
        }

        const targetDepartment = isWebsiteManager(req.user)
          ? (department || requestDepartment || req.user.department)
          : req.user.department

        if (!targetDepartment) {
          failed.push({ row: rowNumber, reason: 'department is required' })
          continue
        }

        try {
          const hash = await bcrypt.hash(finalPassword, 10)
          const created = await User.create({
            name,
            email,
            password: hash,
            role,
            phone,
            department: targetDepartment,
            year: Number.isFinite(year) ? year : undefined,
            section: section || undefined,
            batch: batch || undefined
          })

          existingEmailSet.add(email)
          createdUsers.push({
            _id: created._id,
            name: created.name,
            email: created.email,
            role: created.role,
            department: created.department,
            year: created.year,
            section: created.section,
            batch: created.batch
          })
        } catch (err) {
          failed.push({ row: rowNumber, reason: err.message })
        }
      }

      const response = {
        message: 'Bulk upload completed',
        summary: {
          total: normalizedRows.length,
          created: createdUsers.length,
          skipped: skipped.length,
          failed: failed.length
        },
        createdUsers,
        skipped,
        failed
      }

      await logActivity({
        actor: req.user,
        action: 'bulk_user_import',
        entityType: 'user',
        summary: `Bulk import completed with ${createdUsers.length} created, ${skipped.length} skipped, ${failed.length} failed`,
        department: isWebsiteManager(req.user) ? requestDepartment || req.user.department : req.user.department,
        metadata: { total: normalizedRows.length, created: createdUsers.length, skipped: skipped.length, failed: failed.length }
      })

      return res.json(response)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
)

/**
 * ============================================
 * GET USERS 
 * - Admin: can see all users in their department (or all if no department)
 * - Faculty: can see students in their department
 * - Supports query params: department, role
 * ============================================
 */
router.get(
  '/users',
  verifyToken,
  requireRole('admin', 'hod', 'faculty'),
  async (req, res) => {
    try {
      const { department, role, scope } = req.query
      
      // Build query based on user role and query params
      let query = {}
      
      const adminWantsAll = req.user.role === 'admin' && scope === 'all'

      if (req.user.role === 'faculty' && req.user.department) {
        query.department = req.user.department
      } else if (isDepartmentAdmin(req.user) && req.user.department) {
        query.department = req.user.department
      } else if (req.user.role === 'admin' && req.user.department && !adminWantsAll) {
        query.department = req.user.department
      }
      
      // Override with department query param if provided (for faculty dashboard)
      if (department) {
        if ((req.user.role === 'faculty' || isDepartmentAdmin(req.user)) && req.user.department && department !== req.user.department) {
          return res.status(403).json({ message: 'Department access is fixed for your account' })
        }
        query.department = department
      }
      
      // Filter by role if provided
      if (role) {
        query.role = role
      }

      const users = await User.find(query).select('-password')

      res.json({ users })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)

router.get(
  '/users/export',
  verifyToken,
  requireRole('admin', 'hod', 'faculty'),
  async (req, res) => {
    try {
      const { department, role, scope } = req.query

      let query = {}
      const adminWantsAll = req.user.role === 'admin' && scope === 'all'

      if (req.user.role === 'faculty' && req.user.department) {
        query.department = req.user.department
      } else if (isDepartmentAdmin(req.user) && req.user.department) {
        query.department = req.user.department
      } else if (req.user.role === 'admin' && req.user.department && !adminWantsAll) {
        query.department = req.user.department
      }

      if (department) {
        if ((req.user.role === 'faculty' || isDepartmentAdmin(req.user)) && req.user.department && department !== req.user.department) {
          return res.status(403).json({ message: 'Department access is fixed for your account' })
        }
        query.department = department
      }

      if (role) {
        query.role = role
      }

      const users = await User.find(query).select('-password')
      const csv = toCsv(users, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'role', label: 'Role' },
        { key: 'department', label: 'Department' },
        { key: 'year', label: 'Year' },
        { key: 'section', label: 'Section' },
        { key: 'batch', label: 'Batch' }
      ])

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"')
      res.send(csv)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * ============================================
 * UPDATE USER (Only same department)
 * ============================================
 */
router.put(
  '/users/:id',
  verifyToken,
  requireRole('admin', 'hod', 'faculty'),
  async (req, res) => {
    try {
      const updates = { ...req.body }

      const existingUser = await User.findById(req.params.id).select('-password')

      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (req.user.role === 'faculty') {
        if (existingUser.department !== req.user.department) {
          return res.status(403).json({ message: 'Cannot update users from different department' })
        }
        if (existingUser.role !== 'student') {
          return res.status(403).json({ message: 'Faculty can only update student accounts' })
        }
        if (updates.role && updates.role !== 'student') {
          return res.status(403).json({ message: 'Faculty cannot change role from student' })
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'department') && updates.department !== existingUser.department) {
          return res.status(403).json({ message: 'Faculty cannot change user department' })
        }
      }

      if (isDepartmentAdmin(req.user)) {
        if (existingUser.department !== req.user.department) {
          return res.status(403).json({ message: 'Cannot update users from different department' })
        }
        if (existingUser.role === 'hod') {
          return res.status(403).json({ message: 'Department admin cannot update another department admin account' })
        }
        if (updates.role && ['admin', 'hod'].includes(updates.role)) {
          return res.status(403).json({ message: 'Department admin cannot assign website manager or department admin role' })
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'department') && updates.department !== existingUser.department) {
          return res.status(403).json({ message: 'Department admin cannot change user department' })
        }
      }

      if (
        existingUser.role === 'admin' &&
        Object.prototype.hasOwnProperty.call(updates, 'department') &&
        updates.department !== existingUser.department
      ) {
        return res.status(403).json({ message: 'Department admin assignment is fixed and cannot be changed' })
      }

      const targetRole = updates.role || existingUser.role
      const targetBatch = Object.prototype.hasOwnProperty.call(updates, 'batch') ? updates.batch : existingUser.batch
      if (targetRole === 'student' && !String(targetBatch || '').trim()) {
        return res.status(400).json({ message: 'Academic batch is required for students' })
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
        updates.phone = String(updates.phone || '').trim()
      }

      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10)
      }

      const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password')

      await logActivity({
        actor: req.user,
        action: 'user_update',
        entityType: 'user',
        entityId: user._id,
        summary: `Updated user ${user.name}`,
        department: user.department,
        metadata: { role: user.role, email: user.email }
      })

      res.json({ user })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * ============================================
 * DELETE USER (Only same department)
 * ============================================
 */
router.delete(
  '/users/:id',
  verifyToken,
  requireRole('admin', 'hod', 'faculty'),
  async (req, res) => {
    try {
      const targetUser = isWebsiteManager(req.user)
        ? await User.findById(req.params.id)
        : await User.findOne({
            _id: req.params.id,
            department: req.user.department
          })

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' })
      }

      if (req.user.role === 'faculty' && targetUser.role !== 'student') {
        return res.status(403).json({ message: 'Faculty can only delete student accounts' })
      }

      if (isDepartmentAdmin(req.user) && !['faculty', 'student'].includes(targetUser.role)) {
        return res.status(403).json({ message: 'Department admin can only delete faculty or student accounts' })
      }

      await User.findByIdAndDelete(targetUser._id)

      await logActivity({
        actor: req.user,
        action: 'user_delete',
        entityType: 'user',
        entityId: targetUser._id,
        summary: `Deleted user ${targetUser.name}`,
        department: targetUser.department,
        metadata: { role: targetUser.role, email: targetUser.email }
      })

      res.json({ message: 'User deleted successfully' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)

/**
 * ============================================
 * REGISTER DEPARTMENT WITH ADMIN (Website Manager)
 * ============================================
 */
router.post(
  '/departments/register',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { departmentName, adminName, adminEmail, adminPassword } = req.body

      if (!departmentName || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ message: 'All fields are required' })
      }

      const normalizedDepartment = String(departmentName).trim().toUpperCase()
      const normalizedEmail = String(adminEmail).trim().toLowerCase()

      if (!normalizedDepartment) {
        return res.status(400).json({ message: 'Department name is required' })
      }

      const existingDepartment = await Department.findOne({ name: normalizedDepartment })
      if (existingDepartment) {
        return res.status(400).json({ message: 'Department already exists' })
      }

      const existingUser = await User.findOne({ email: normalizedEmail })
      if (existingUser) {
        return res.status(400).json({ message: 'Admin email already exists' })
      }

      const defaultYearConfig = {
        year1: { subjects: [], sections: [] },
        year2: { subjects: [], sections: [] },
        year3: { subjects: [], sections: [] },
        year4: { subjects: [], sections: [] }
      }

      const department = new Department({
        name: normalizedDepartment,
        subjects: [],
        sections: [],
        yearConfigs: {
          year1: {
            subjects: [...defaultYearConfig.year1.subjects],
            sections: [...defaultYearConfig.year1.sections]
          },
          year2: {
            subjects: [...defaultYearConfig.year2.subjects],
            sections: [...defaultYearConfig.year2.sections]
          },
          year3: {
            subjects: [...defaultYearConfig.year3.subjects],
            sections: [...defaultYearConfig.year3.sections]
          },
          year4: {
            subjects: [...defaultYearConfig.year4.subjects],
            sections: [...defaultYearConfig.year4.sections]
          }
        },
        materials: []
      })

      await department.save()

      const hash = await bcrypt.hash(adminPassword, 10)
      const adminUser = new User({
        name: adminName,
        email: normalizedEmail,
        password: hash,
        role: 'admin',
        department: normalizedDepartment
      })

      await adminUser.save()

      await logActivity({
        actor: req.user,
        action: 'department_register',
        entityType: 'department',
        entityId: department._id,
        summary: `Registered department ${department.name} with admin ${adminName}`,
        department: department.name,
        metadata: { adminEmail: normalizedEmail }
      })

      const departmentAdminPayload = {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        department: adminUser.department
      }

      return res.status(201).json({
        message: 'Department and Department Admin (HOD) registered successfully',
        department: {
          _id: department._id,
          name: department.name
        },
        departmentAdmin: departmentAdminPayload,
        hod: departmentAdminPayload
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
)

router.post(
  '/website-managers/register',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const hasWebsiteManager = await User.exists({
        role: 'admin',
        $or: [
          { department: { $exists: false } },
          { department: null },
          { department: '' }
        ]
      })

      if (req.user.department && hasWebsiteManager) {
        return res.status(403).json({ message: 'Only website manager can register another website manager' })
      }

      const { name, email, password } = req.body

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' })
      }

      const normalizedEmail = String(email).trim().toLowerCase()

      const existingUser = await User.findOne({ email: normalizedEmail })
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' })
      }

      const hash = await bcrypt.hash(password, 10)
      const websiteManager = new User({
        name: String(name).trim(),
        email: normalizedEmail,
        password: hash,
        role: 'admin'
      })

      await websiteManager.save()

      await logActivity({
        actor: req.user,
        action: 'website_manager_register',
        entityType: 'user',
        entityId: websiteManager._id,
        summary: `Registered website manager ${websiteManager.name}`,
        metadata: { email: websiteManager.email }
      })

      return res.status(201).json({
        message: 'Website manager registered successfully',
        user: {
          _id: websiteManager._id,
          name: websiteManager.name,
          email: websiteManager.email,
          role: websiteManager.role
        }
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }
)

module.exports = router

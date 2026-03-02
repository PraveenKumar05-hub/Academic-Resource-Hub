const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const Department = require('../models/Department')
const { verifyToken, requireRole } = require('../middleware/auth')

function isWebsiteManager(user) {
  return user?.role === 'admin' && !user?.department
}

function isDepartmentAdmin(user) {
  return user?.role === 'hod' || (user?.role === 'admin' && !!user?.department)
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

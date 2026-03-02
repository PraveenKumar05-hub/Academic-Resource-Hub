const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { verifyToken, requireRole } = require('../middleware/auth');

function getYearKey(year) {
  const yearNum = Number(year)
  if (![1, 2, 3, 4].includes(yearNum)) return null
  return `year${yearNum}`
}

function ensureYearConfigs(dept) {
  if (!dept.yearConfigs) {
    dept.yearConfigs = {}
  }

  for (const key of ['year1', 'year2', 'year3', 'year4']) {
    if (!dept.yearConfigs[key]) {
      dept.yearConfigs[key] = { subjects: [], sections: [] }
    }
    if (!Array.isArray(dept.yearConfigs[key].subjects)) {
      dept.yearConfigs[key].subjects = []
    }
    dept.yearConfigs[key].subjects = dept.yearConfigs[key].subjects
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string') {
          return { name: item, credits: 0 }
        }
        if (typeof item === 'object' && item.name) {
          return {
            name: item.name,
            credits: Number.isFinite(Number(item.credits)) ? Number(item.credits) : 0
          }
        }
        return null
      })
      .filter((item) => item?.name)
    if (!Array.isArray(dept.yearConfigs[key].sections)) {
      dept.yearConfigs[key].sections = []
    }
  }
}

function syncFlatArraysFromYearConfigs(dept) {
  const subjectSet = new Set()
  const sectionSet = new Set()

  for (const key of ['year1', 'year2', 'year3', 'year4']) {
    for (const subject of dept.yearConfigs[key].subjects || []) {
      if (subject?.name) subjectSet.add(subject.name)
    }
    for (const section of dept.yearConfigs[key].sections || []) {
      if (section) sectionSet.add(section)
    }
  }

  dept.subjects = Array.from(subjectSet)
  dept.sections = Array.from(sectionSet)
}

function ensureDepartmentAccess(req, res) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'hod') {
    return true;
  }

  if (req.user?.role === 'admin' && !req.user.department) {
    return true;
  }

  if (req.params.name !== req.user.department) {
    res.status(403).json({ message: 'Department admin (HOD) can only access their own department' });
    return false;
  }

  return true;
}

// List departments (for faculty/admin dropdowns)
router.get('/', verifyToken, requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const departments = await Department.find({}, { name: 1 }).sort({ name: 1 }).lean()
    res.json({ departments: departments.map((item) => item.name).filter(Boolean) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get department details
router.get('/:name', verifyToken, async (req, res) => {
  try {
    if (!ensureDepartmentAccess(req, res)) return;

    const dept = await Department.findOne({ name: req.params.name });
    if (!dept) return res.status(404).json({ message: 'Not found' });

    ensureYearConfigs(dept)
    syncFlatArraysFromYearConfigs(dept)
    dept.markModified('yearConfigs')
    await dept.save()

    res.json({ department: dept });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Department Admin (HOD)/Admin: add subject
router.post('/:name/subjects', verifyToken, requireRole('admin', 'hod'), async (req, res) => {
  try {
    if (!ensureDepartmentAccess(req, res)) return;

    const { subject, year, credits } = req.body;
    if (!subject) return res.status(400).json({ message: 'Missing subject' });

    const yearKey = getYearKey(year)
    if (!yearKey) return res.status(400).json({ message: 'Valid year (1-4) is required' })

    const dept = await Department.findOne({ name: req.params.name })
    if (!dept) return res.status(404).json({ message: 'Not found' })

    ensureYearConfigs(dept)
    const normalizedName = String(subject).trim()
    if (credits === '' || credits === null || credits === undefined) {
      return res.status(400).json({ message: 'Credits are required' })
    }
    const normalizedCredits = Number(credits)
    if (!Number.isFinite(normalizedCredits) || normalizedCredits < 0) {
      return res.status(400).json({ message: 'Credits must be a valid non-negative number' })
    }

    const alreadyExists = (dept.yearConfigs[yearKey].subjects || []).some(
      (item) => String(item.name).trim().toLowerCase() === normalizedName.toLowerCase()
    )

    if (!alreadyExists) {
      dept.yearConfigs[yearKey].subjects.push({
        name: normalizedName,
        credits: normalizedCredits
      })
    }
    syncFlatArraysFromYearConfigs(dept)
    dept.markModified('yearConfigs')
    await dept.save()

    res.json({ department: dept });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Department Admin (HOD)/Admin: remove subject
router.delete('/:name/subjects', verifyToken, requireRole('admin', 'hod'), async (req, res) => {
  try {
    if (!ensureDepartmentAccess(req, res)) return;

    const { subject, year } = req.body;
    const yearKey = getYearKey(year)
    if (!yearKey) return res.status(400).json({ message: 'Valid year (1-4) is required' })

    const dept = await Department.findOne({ name: req.params.name })
    if (!dept) return res.status(404).json({ message: 'Not found' })

    ensureYearConfigs(dept)
    dept.yearConfigs[yearKey].subjects = (dept.yearConfigs[yearKey].subjects || []).filter(
      (item) => String(item.name).trim().toLowerCase() !== String(subject).trim().toLowerCase()
    )
    syncFlatArraysFromYearConfigs(dept)
    dept.markModified('yearConfigs')
    await dept.save()

    res.json({ department: dept });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Department Admin (HOD)/Admin: add section
router.post('/:name/sections', verifyToken, requireRole('admin', 'hod'), async (req, res) => {
  try {
    if (!ensureDepartmentAccess(req, res)) return;

    const { section, year } = req.body;
    if (!section) return res.status(400).json({ message: 'Missing section' });

    const yearKey = getYearKey(year)
    if (!yearKey) return res.status(400).json({ message: 'Valid year (1-4) is required' })

    const dept = await Department.findOne({ name: req.params.name })
    if (!dept) return res.status(404).json({ message: 'Not found' })

    ensureYearConfigs(dept)
    const normalizedSection = String(section).trim().toUpperCase()
    if (!dept.yearConfigs[yearKey].sections.includes(normalizedSection)) {
      dept.yearConfigs[yearKey].sections.push(normalizedSection)
    }
    syncFlatArraysFromYearConfigs(dept)
    dept.markModified('yearConfigs')
    await dept.save()

    res.json({ department: dept });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Department Admin (HOD)/Admin: remove section
router.delete('/:name/sections', verifyToken, requireRole('admin', 'hod'), async (req, res) => {
  try {
    if (!ensureDepartmentAccess(req, res)) return;

    const { section, year } = req.body;
    const yearKey = getYearKey(year)
    if (!yearKey) return res.status(400).json({ message: 'Valid year (1-4) is required' })

    const dept = await Department.findOne({ name: req.params.name })
    if (!dept) return res.status(404).json({ message: 'Not found' })

    ensureYearConfigs(dept)
    const normalizedSection = String(section).trim().toUpperCase()
    dept.yearConfigs[yearKey].sections = (dept.yearConfigs[yearKey].sections || []).filter((item) => item !== normalizedSection)
    syncFlatArraysFromYearConfigs(dept)
    dept.markModified('yearConfigs')
    await dept.save()

    res.json({ department: dept });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

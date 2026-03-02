const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_LOCK_MS = 10 * 60 * 1000;

function getOtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, year, section, batch } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: 'Email exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email: normalizedEmail,
      password: hash,
      role,
      department,
      year,
      section,
      batch
    });

    await user.save();
    res.json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        department: user.department
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
        year: user.year,
        section: user.section,
        batch: user.batch
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/forgot-password/request-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const transporter = getOtpTransporter();
    if (!transporter) {
      return res.status(500).json({ message: 'Email service is not configured. Set SMTP env variables.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email does not exist' });
    }

    const now = Date.now();
    const lockUntil = user.passwordResetOtpLockedUntil ? new Date(user.passwordResetOtpLockedUntil).getTime() : 0;

    if (lockUntil > now) {
      const retryAfterSeconds = Math.ceil((lockUntil - now) / 1000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${retryAfterSeconds} seconds.` });
    }

    const requestedAt = user.passwordResetOtpRequestedAt ? new Date(user.passwordResetOtpRequestedAt).getTime() : 0;
    if (requestedAt && now - requestedAt < OTP_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((OTP_COOLDOWN_MS - (now - requestedAt)) / 1000);
      return res.status(429).json({ message: `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.` });
    }

    const otp = generateOtpCode();
    user.passwordResetOtpHash = hashOtp(otp);
    user.passwordResetOtpExpiresAt = new Date(now + OTP_EXPIRY_MS);
    user.passwordResetOtpRequestedAt = new Date(now);
    user.passwordResetOtpFailedAttempts = 0;
    user.passwordResetOtpLockedUntil = undefined;
    await user.save();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'Academic Resource Hub - Password Reset OTP',
      text: `Your password reset OTP is ${otp}. This code will expire in 10 minutes.`,
      html: `<p>Your password reset OTP is <strong>${otp}</strong>.</p><p>This code will expire in 10 minutes.</p>`
    });

    return res.status(200).json({ message: 'OTP has been sent to your email.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
});

router.post('/forgot-password/reset', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const now = Date.now();
    const lockUntil = user.passwordResetOtpLockedUntil ? new Date(user.passwordResetOtpLockedUntil).getTime() : 0;
    if (lockUntil > now) {
      const retryAfterSeconds = Math.ceil((lockUntil - now) / 1000);
      return res.status(429).json({ message: `Too many failed attempts. Try again in ${retryAfterSeconds} seconds.` });
    }

    if (new Date(user.passwordResetOtpExpiresAt).getTime() < now) {
      user.passwordResetOtpHash = undefined;
      user.passwordResetOtpExpiresAt = undefined;
      user.passwordResetOtpRequestedAt = undefined;
      user.passwordResetOtpFailedAttempts = 0;
      user.passwordResetOtpLockedUntil = undefined;
      await user.save();
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const providedOtpHash = hashOtp(otp);
    if (providedOtpHash !== user.passwordResetOtpHash) {
      user.passwordResetOtpFailedAttempts = Number(user.passwordResetOtpFailedAttempts || 0) + 1;

      if (user.passwordResetOtpFailedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
        user.passwordResetOtpLockedUntil = new Date(now + OTP_LOCK_MS);
      }

      await user.save();

      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpRequestedAt = undefined;
    user.passwordResetOtpFailedAttempts = 0;
    user.passwordResetOtpLockedUntil = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/smtp-health', async (_req, res) => {
  try {
    const transporter = getOtpTransporter();

    if (!transporter) {
      return res.status(200).json({
        smtpConfigured: false,
        smtpConnectionOk: false,
        message: 'SMTP environment variables are missing'
      });
    }

    await transporter.verify();

    return res.status(200).json({
      smtpConfigured: true,
      smtpConnectionOk: true,
      message: 'SMTP is configured and reachable'
    });
  } catch (error) {
    return res.status(200).json({
      smtpConfigured: true,
      smtpConnectionOk: false,
      message: 'SMTP configured but connection/auth failed',
      error: error.message
    });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

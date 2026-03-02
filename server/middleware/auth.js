const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

async function verifyToken(req, res, next) {
  try {
    // Check for token in Authorization header, x-access-token header, or query parameter
    const authHeader = req.headers.authorization || req.headers['x-access-token'];
    let token = null;
    
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    } else if (req.query.token) {
      token = req.query.token;
    }
    
    if (!token) return res.status(401).json({ message: 'No token provided' });
    
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { verifyToken, requireRole };

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('department');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token or inactive account.' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log(`AUTH DENIED: User '${req.user.name}' (${req.user.email}) has role '${req.user.role}', required: [${roles.join(', ')}] for ${req.method} ${req.originalUrl}`);
      return res.status(403).json({ message: `Access denied. Your role '${req.user.role}' does not have permission. Required: ${roles.join(', ')}` });
    }
    next();
  };
};

module.exports = { auth, authorize };

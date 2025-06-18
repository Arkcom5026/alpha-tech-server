const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      profileType: decoded.profileType || 'customer',
      profileId: decoded.profileId || null,
      branchId: decoded.branchId || null,
      employeeId: decoded.employeeId || null,
    };

    if (decoded.profileType === 'employee' && !decoded.employeeId) {
      console.warn('⚠️ JWT profileType = employee แต่ไม่มี employeeId');
    }

    next();
  } catch (err) {
    console.error('❌ [verifyToken] JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = { verifyToken };

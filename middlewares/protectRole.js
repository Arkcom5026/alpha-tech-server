exports.protectRole = (...allowedRoles) => {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง' });
      }
      next();
    };
  };
  
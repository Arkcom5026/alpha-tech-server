// ✅ middleware/rbac.js
import { permissionsByPosition } from '../utils/rbacPermissions.js';

export const allowPosition = (allowed = []) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const position = user.position; // ✅ ตำแหน่งควรถูก encode ใน JWT

    const userPermissions = permissionsByPosition[position] || [];

    const hasPermission = allowed.every((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    next();
  };
};

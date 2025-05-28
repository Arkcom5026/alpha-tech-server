// ✅ routes/currentEmployeeRoutes.js
import express from 'express';
import { getCurrentEmployee } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

router.get('/current-employee', verifyToken, getCurrentEmployee);

export default router;

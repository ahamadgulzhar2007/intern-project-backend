import express from 'express';
import { getLiveDashboard } from '../controllers/dashboardController.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/live', verifyAdmin, getLiveDashboard);

export default router;

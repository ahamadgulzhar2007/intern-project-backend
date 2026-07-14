import express from 'express';
import { updateDevice, controlDevice } from '../controllers/deviceController.js';
import { verifyDeviceKey, verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ESP32 hits this endpoint
router.post('/update', verifyDeviceKey, updateDevice);

// React Admin Dashboard hits this endpoint
router.post('/control', verifyAdmin, controlDevice);

export default router;

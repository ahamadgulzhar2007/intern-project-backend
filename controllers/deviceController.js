import { db, FieldValue } from '../firebase/admin.js';
import { sendOverloadEmail } from '../utils/emailService.js';

// Cache for device configs to avoid reading Firestore on every 2-second ping
const configCache = {};
const alertCache = {}; // Tracks if an email was sent for an ongoing overload

export const updateDevice = async (req, res) => {
  try {
    const { deviceId, firmware, sensors, dc, ac, relay, status } = req.body;
    
    if (!deviceId) return res.status(400).json({ success: false, error: 'deviceId required' });

    const deviceRef = db.collection('devices').doc(deviceId);
    
    // 1. Get or refresh config (cache it for 15 seconds)
    const now = Date.now();
    let config = configCache[deviceId]?.data;
    if (!config || (now - configCache[deviceId].timestamp > 15000)) {
      const configDoc = await deviceRef.collection('config').doc('settings').get();
      if (configDoc.exists) {
        config = configDoc.data();
        configCache[deviceId] = { data: config, timestamp: now };
      } else {
        // Default config if none exists
        config = { currentLimit: 10, voltageMin: 0, voltageMax: 250 };
      }
    }

    // 2. Read desired relay state from info/status to see if Dashboard turned it off/on
    // (We might want to cache this too, or rely on the frontend sending control commands)
    const infoDoc = await deviceRef.collection('info').doc('state').get();
    let desiredRelay = infoDoc.exists ? infoDoc.data().relay : relay;
    let alertEmail = infoDoc.exists ? infoDoc.data().alertEmail : null;

    // 3. Overload Logic (Threshold check)
    let isOverload = false;
    if (ac?.current > (config.currentLimit || 10) || dc?.current > (config.currentLimit || 5)) {
      isOverload = true;
      desiredRelay = false; // Force relay off
    }

    // 4. Update live readings & info
    const batch = db.batch();
    
    // info/state
    batch.set(deviceRef.collection('info').doc('state'), {
      online: true,
      lastSeen: FieldValue.serverTimestamp(),
      firmware: firmware || 'unknown',
      sensorHealth: sensors || {},
      relay: desiredRelay,
      status: isOverload ? 'OVERLOAD' : 'NORMAL'
    }, { merge: true });

    // live/current_readings
    const readings = {
      ac: ac || {},
      dc: dc || {},
      relay: desiredRelay,
      status: isOverload ? 'OVERLOAD' : 'NORMAL',
      updatedAt: FieldValue.serverTimestamp()
    };
    batch.set(deviceRef.collection('live').doc('current_readings'), readings);

    // history (log every update)
    batch.set(deviceRef.collection('history').doc(), {
      ...readings,
      timestamp: FieldValue.serverTimestamp()
    });

    // 5. Handle Overload Alert & Email
    if (isOverload) {
      if (!alertCache[deviceId]) {
        // First time seeing this overload
        alertCache[deviceId] = true;
        
        batch.set(deviceRef.collection('alerts').doc(), {
          type: 'OVERLOAD',
          ac: ac || {},
          dc: dc || {},
          relay: false,
          time: FieldValue.serverTimestamp()
        });

        // Send Email asynchronously
        if (alertEmail) {
          sendOverloadEmail(alertEmail, deviceId, readings).catch(console.error);
        }
      }
    } else {
      // Clear alert cache when normal
      alertCache[deviceId] = false;
    }

    await batch.commit();

    // 6. Return response to ESP32
    return res.status(200).json({
      success: true,
      relay: desiredRelay,
      config: config
    });

  } catch (error) {
    console.error("Update Device Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const controlDevice = async (req, res) => {
  try {
    const { deviceId, relay } = req.body;
    if (!deviceId || typeof relay !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Invalid parameters' });
    }

    await db.collection('devices').doc(deviceId)
            .collection('info').doc('state')
            .set({ relay }, { merge: true });
            
    return res.status(200).json({ success: true, message: 'Control command sent' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

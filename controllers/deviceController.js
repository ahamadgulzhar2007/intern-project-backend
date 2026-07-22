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
    if (!config || (now - (configCache[deviceId]?.timestamp || 0) > 15000)) {
      const configDoc = await deviceRef.collection('config').doc('settings').get();
      if (configDoc.exists) {
        config = configDoc.data();
        configCache[deviceId] = { data: config, timestamp: now };
      } else {
        // Sensible defaults — DC uses INA219 (max ~3.2A), AC uses ZMPT/ACS712
        config = {
          dcCurrentLimit:  2.0,   // Amps — trip if DC current > 2A
          acCurrentLimit:  10.0,  // Amps — trip if AC current > 10A
          voltageMin:      0,
          voltageMax:      250
        };
        // Write defaults into Firestore so Settings page can show/edit them
        await deviceRef.collection('config').doc('settings').set(config);
        configCache[deviceId] = { data: config, timestamp: now };
      }
    }

    // 2. Read desired relay state & alert email from Firestore
    const infoDoc = await deviceRef.collection('info').doc('state').get();
    let desiredRelay = infoDoc.exists ? (infoDoc.data().relay ?? relay) : relay;
    let alertEmail   = infoDoc.exists ? infoDoc.data().alertEmail : null;

    // 3. ── Overload Logic ──────────────────────────────────────────
    // Separate thresholds for AC and DC
    const dcLimit = config.dcCurrentLimit ?? config.currentLimit ?? 2.0;
    const acLimit = config.acCurrentLimit ?? config.currentLimit ?? 10.0;

    const dcOverload = dc?.current  != null && dc.current  > dcLimit;
    const acOverload = ac?.current  != null && ac.current  > acLimit && ac?.enabled !== false;
    const isOverload = dcOverload || acOverload;

    // Build a human-readable overload reason
    let overloadReason = '';
    if (dcOverload) overloadReason += `DC current ${dc.current.toFixed(2)}A > limit ${dcLimit}A. `;
    if (acOverload) overloadReason += `AC current ${ac.current.toFixed(2)}A > limit ${acLimit}A.`;

    if (isOverload) {
      desiredRelay = false; // Force relay OFF immediately
    }
    // ─────────────────────────────────────────────────────────────

    // 4. Update live readings & info in one batch
    const batch = db.batch();

    // info/state
    batch.set(deviceRef.collection('info').doc('state'), {
      online:       true,
      lastSeen:     FieldValue.serverTimestamp(),
      firmware:     firmware || 'unknown',
      sensorHealth: sensors || {},
      relay:        desiredRelay,
      status:       isOverload ? 'OVERLOAD' : (status || 'NORMAL')
    }, { merge: true });

    // live/current_readings
    const readings = {
      ac:        ac  || {},
      dc:        dc  || {},
      relay:     desiredRelay,
      status:    isOverload ? 'OVERLOAD' : (status || 'NORMAL'),
      updatedAt: FieldValue.serverTimestamp()
    };
    batch.set(deviceRef.collection('live').doc('current_readings'), readings);

    // history
    batch.set(deviceRef.collection('history').doc(), {
      ...readings,
      timestamp: FieldValue.serverTimestamp()
    });

    // 5. Handle Overload Alert & Email (throttle: only once per event)
    if (isOverload) {
      if (!alertCache[deviceId]) {
        alertCache[deviceId] = true;

        const alertDocRef = deviceRef.collection('alerts').doc();
        batch.set(alertDocRef, {
          type:   'OVERLOAD',
          reason: overloadReason,
          ac:     ac || {},
          dc:     dc || {},
          relay:  false,
          time:   FieldValue.serverTimestamp(),
          emailSent: false
        });

        if (alertEmail) {
          sendOverloadEmail(alertEmail, deviceId, { ...readings, overloadReason })
            .then(data => {
              if (data) {
                console.log(`✅ Email sent to ${alertEmail}`);
                alertDocRef.update({ emailSent: true }).catch(console.error);
              }
            })
            .catch(err => console.error("❌ Email failed:", err));
        }

        console.log(`⚠️  OVERLOAD on ${deviceId}: ${overloadReason}`);
      }
    } else {
      alertCache[deviceId] = false; // Reset so next overload fires a new email
    }

    await batch.commit();

    // 6. Return response to ESP32
    return res.status(200).json({
      success: true,
      relay:   desiredRelay,
      status:  isOverload ? 'OVERLOAD' : 'NORMAL',
      config:  {
        dcCurrentLimit: dcLimit,
        acCurrentLimit: acLimit,
        voltageMin:     config.voltageMin,
        voltageMax:     config.voltageMax
      }
    });

  } catch (error) {
    console.error('Update Device Error:', error);
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

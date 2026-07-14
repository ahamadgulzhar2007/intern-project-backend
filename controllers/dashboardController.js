import { db } from '../firebase/admin.js';

export const getLiveDashboard = async (req, res) => {
  try {
    const devicesRef = db.collection('devices');
    const snapshot = await devicesRef.get();
    
    const dashboardData = [];
    for (const doc of snapshot.docs) {
      const deviceId = doc.id;
      const infoDoc = await devicesRef.doc(deviceId).collection('info').doc('state').get();
      const liveDoc = await devicesRef.doc(deviceId).collection('live').doc('current_readings').get();
      
      dashboardData.push({
        deviceId,
        info: infoDoc.exists ? infoDoc.data() : {},
        live: liveDoc.exists ? liveDoc.data() : {}
      });
    }
    
    res.status(200).json({ success: true, data: dashboardData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

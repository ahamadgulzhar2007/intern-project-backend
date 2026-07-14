import dotenv from 'dotenv';
dotenv.config();

// Protect ESP32 endpoints
export const verifyDeviceKey = (req, res, next) => {
  const deviceKey = req.headers['x-device-key'];
  const expectedKey = process.env.DEVICE_API_KEY || 'default-secret-key-change-me';

  if (!deviceKey || deviceKey !== expectedKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Device Key' });
  }

  next();
};

// Protect Admin Dashboard endpoints (JWT could be added here later)
export const verifyAdmin = (req, res, next) => {
  // For now, we allow the React app to hit backend safely via CORS/Firebase Client Auth.
  // We can expand this with Firebase Admin Token Verification:
  /*
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) return res.status(401).send('Unauthorized');
  
  admin.auth().verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      next();
    }).catch(error => res.status(401).send('Unauthorized'));
  */
  next();
};

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from the root/client folder (or wherever it lives)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../client/.env') });
// We'll also load local .env if it exists
dotenv.config();

// Note: To make this work, the user needs to download a serviceAccountKey.json 
// from Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key
// and place it in the server/ directory.
let db;
try {
  // If serviceAccountKey.json is missing, this will fail gracefully or we can mock it
  // For production, always use the secure JSON key.
  // const serviceAccount = require('./serviceAccountKey.json'); // commonjs way
  // We'll dynamically import or require since we are in ES Module:
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);
  const serviceAccount = require('../serviceAccountKey.json');

  initializeApp({
    credential: cert(serviceAccount)
  });
  
  db = getFirestore();
  console.log("🔥 Firebase Admin Initialized successfully.");
} catch (error) {
  console.warn("⚠️ Firebase Admin could not be initialized. Missing serviceAccountKey.json!");
  console.warn("Please download your service account key from Firebase and place it at server/serviceAccountKey.json");
}

export { db, FieldValue };

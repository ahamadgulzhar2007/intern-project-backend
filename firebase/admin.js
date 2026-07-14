import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

try {
  // Try to load serviceAccountKey.json from the project root
  const keyPath = resolve(__dirname, '../serviceAccountKey.json');

  let serviceAccount;

  if (existsSync(keyPath)) {
    // Local development: read from file
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    console.log('🔑 Loaded serviceAccountKey.json from file.');
  } else {
    // Production (Render): read from environment variable
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('Neither serviceAccountKey.json nor FIREBASE_SERVICE_ACCOUNT env var found!');
    }
    serviceAccount = JSON.parse(raw);
    console.log('🔑 Loaded Firebase credentials from environment variable.');
  }

  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log('🔥 Firebase Admin Initialized successfully.');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
}

export { db, FieldValue };

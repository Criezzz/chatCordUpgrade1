const admin = require('firebase-admin');
const config = require('../config');
const fs = require('fs');

let initialized = false;
function initFirebase() {
  if (initialized) return;
  const saPath = config.FIREBASE_SERVICE_ACCOUNT;
  if (!saPath) {
    console.warn('No FIREBASE_SERVICE_ACCOUNT provided; Firebase Admin not initialized');
    return;
  }
  if (!fs.existsSync(saPath)) {
    console.warn(`Service account file not found at ${saPath}`);
    return;
  }
  const serviceAccount = require(saPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
}

async function verifyIdToken(token) {
  initFirebase();
  if (!initialized) throw new Error('Firebase Admin not initialized');
  return admin.auth().verifyIdToken(token);
}

module.exports = { initFirebase, verifyIdToken, admin };

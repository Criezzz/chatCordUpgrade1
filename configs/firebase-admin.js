import admin from "firebase-admin";

// Read service account from environment variable (injected by Secret Manager)
// Expected format: JSON string of the service account key
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. " +
    "Please configure Cloud Run to inject the secret from Secret Manager."
  );
}

const serviceAccount = JSON.parse(serviceAccountJson);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export default admin;
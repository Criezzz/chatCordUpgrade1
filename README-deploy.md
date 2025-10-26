# Deploy guide (Firebase Hosting frontend + Cloud Run backend)

This guide shows how to deploy the frontend to Firebase Hosting and the backend (Socket.IO + Node.js) to Cloud Run. It assumes you will use a hosted Redis (Upstash or Redis Cloud) for production instead of Memorystore to keep the setup simple.

Prereqs:
- Node.js v20+ (local development and Cloud Build image)
- gcloud CLI installed and authenticated
- firebase-tools installed and authenticated
- Docker installed (for local build or Cloud Build)
- An Upstash/Redis Cloud endpoint (REDIS_URL)
- Service account JSON for Firebase (if you plan to use Firebase Admin on Cloud Run)

1) Build & test locally

```powershell
# install deps
npm install

# run redis locally (dev)
docker run -p 6379:6379 -d --name chat-redis redis:7

# create .env from .env.example and edit values
Copy-Item .env.example .env
notepad .env

# start server locally (dev)
npm run dev
```

2) Deploy backend to Cloud Run (manual build)

```powershell
# set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# build & push container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/chatcord-backend

# deploy to Cloud Run (replace REDIS_URL with your Upstash/Redis URL)
gcloud run deploy chatcord-backend `
  --image gcr.io/YOUR_PROJECT_ID/chatcord-backend `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars REDIS_URL='your_upstash_redis_url',MESSAGE_HISTORY_COUNT=100
```

3) (Optional) Store Firebase service account in Secret Manager and provide to Cloud Run

```powershell
# create secret
gcloud secrets create firebase-sa --data-file=./serviceAccountKey.json

# deploy with secret mapped to env var FIREBASE_SERVICE_ACCOUNT
gcloud run deploy chatcord-backend `
  --image gcr.io/YOUR_PROJECT_ID/chatcord-backend `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --update-secrets FIREBASE_SERVICE_ACCOUNT=firebase-sa:latest
```

4) Deploy frontend to Firebase Hosting

```powershell
npm install -g firebase-tools
firebase login
firebase init hosting
# choose 'public' folder -> set to 'public' and do not overwrite index.html if asked
firebase deploy --only hosting
```

5) Update frontend to connect to backend URL
- After deploying Cloud Run note the service URL (e.g. https://chatcord-backend-xxxxx-uc.a.run.app)
- Update `public/js/main.js` to set `const BACKEND_URL = 'https://chatcord-backend-xxxxx-uc.a.run.app'` and connect socket to that URL.

Security notes:
- Use Upstash or Redis Cloud with TLS for production to avoid VPC complexity.
- Use Secret Manager for service account JSON and restrict access.
- Use HTTPS/WSS for client connections.

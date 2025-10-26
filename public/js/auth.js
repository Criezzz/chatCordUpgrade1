import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUWRBa5k8V9-Y9Akaciq_9K7iZFeROrRw",
  authDomain: "webapp-69eb5.firebaseapp.com",
  projectId: "webapp-69eb5",
  storageBucket: "webapp-69eb5.firebasestorage.app",
  messagingSenderId: "707131182426",
  appId: "1:707131182426:web:bad5c901add96ff65ef763"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

await auth.authStateReady();

const getUser = () => {
  return auth.currentUser;
}

export default auth;
export { getUser };
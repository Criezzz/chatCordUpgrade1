import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpKTmFPk2UPve75gLSZ2zOtkjwJ4lD5Ng",
  authDomain: "device-streaming-443f3261.firebaseapp.com",
  projectId: "device-streaming-443f3261",
  storageBucket: "device-streaming-443f3261.firebasestorage.app",
  messagingSenderId: "196498253672",
  appId: "1:196498253672:web:64d9949756993d841a18dd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

await auth.authStateReady();

const getUser = () => {
  return auth.currentUser;
}

export default auth;
export { getUser };
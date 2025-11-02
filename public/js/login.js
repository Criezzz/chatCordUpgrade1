import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import auth, {authCheck} from './auth.js'

const ggprovider = new GoogleAuthProvider();
const fbprovider = new FacebookAuthProvider();
const googleSignIn = async (e) => {
    return signInWithPopup(auth, ggprovider)
        .then((result) => {
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            const user = result.user;
            sessionStorage.setItem("uid", user.uid);
            window.location.href = "/";
        }).catch((error) => {
            console.log(error)
        });
}

const user = getUser();
if (user) {
    window.location.href = "/";
}

document.getElementById('google-login').addEventListener('click', googleSignIn);

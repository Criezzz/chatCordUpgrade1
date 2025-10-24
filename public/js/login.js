import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import auth, {getUser} from './auth.js'

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

const facebookSignIn = async (e) => {
    return signInWithPopup(auth, fbprovider)
        .then((result) => {
            // This gives you a Google Access Token. You can use it to access the Google API.
            const credential = FacebookAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            // The signed-in user info.
            const user = result.user;
            console.log(credential)
            // IdP data available using getAdditionalUserInfo(result)
            // ...
        }).catch((error) => {
            // Handle Errors here.
            const errorCode = error.code;
            const errorMessage = error.message;
            // The email of the user's account used.
            const email = error.customData.email;
            // The AuthCredential type that was used.
            const credential = FacebookAuthProvider.credentialFromError(error);
            // ...
        });
}

const user = getUser();
if (user) {
    window.location.href = "/";
}

document.getElementById('google-login').addEventListener('click', googleSignIn);
document.getElementById('facebook-login').addEventListener('click', facebookSignIn);

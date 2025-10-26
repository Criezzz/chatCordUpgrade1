import auth, { getUser } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const user = getUser();
if (!user) {
  window.location.href = '/login';
}

const logout = () => {
    signOut(auth).then(() => {
        window.location.href = "/login";
    }).catch((error) => {
        console.log(error);
    })
}

document.getElementById("logout").addEventListener("click", logout);
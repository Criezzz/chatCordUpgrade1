import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccount/device-streaming-443f3261-firebase-adminsdk-fbsvc-c8a830c8b0.json", "utf8")
);


admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) }
)

export default admin;
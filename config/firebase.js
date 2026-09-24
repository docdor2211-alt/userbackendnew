// const admin =
//   require("firebase-admin");

// const serviceAccount =
//   require(
//     "../serviceAccountKey.json"
//   );

// admin.initializeApp({

//   credential:
//     admin.credential.cert(
//       serviceAccount
//     ),

// });

// module.exports =
//   admin;

// new code
const admin = require("firebase-admin");

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!raw) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT is missing");
}

let serviceAccount;

try {
  serviceAccount = JSON.parse(raw);
} catch (error) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
}

const privateKey = serviceAccount.private_key
  .replace(/\\n/g, "\n")
  .replace(/\r/g, "");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey,
    }),
  });
}

module.exports = admin;
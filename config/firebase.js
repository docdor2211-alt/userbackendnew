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


const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = admin;
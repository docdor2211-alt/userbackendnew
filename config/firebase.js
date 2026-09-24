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
  try {
    serviceAccount = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8")
    );
  } catch (base64Error) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64 JSON"
    );
  }
}

function normalizePrivateKey(key) {
  if (!key) return key;

  let pem = key.replace(/\\n/g, "\n");

  const headerMatch = pem.match(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  );
  const header = headerMatch
    ? headerMatch[0]
    : "-----BEGIN PRIVATE KEY-----";
  const footer = header.replace("BEGIN", "END");

  const body = pem
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");

  if (!body) return key;

  const lines = body.match(/.{1,64}/g) || [];

  return `${header}\n${lines.join("\n")}\n${footer}\n`;
}

const privateKey = normalizePrivateKey(
  serviceAccount.private_key
);

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
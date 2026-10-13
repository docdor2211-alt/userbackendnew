const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

let serviceAccount;

const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

if (fs.existsSync(serviceAccountPath)) {
  try {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  } catch (err) {
    console.warn("Warning: Could not read serviceAccountKey.json, checking env:", err.message);
  }
}

if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
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
}

if (!serviceAccount) {
  throw new Error("Firebase credentials missing: neither serviceAccountKey.json nor FIREBASE_SERVICE_ACCOUNT found");
}

function normalizePrivateKey(key) {
  if (!key) return key;

  let pem = key.replace(/\\n/g, "\n").trim();

  const headerMatch = pem.match(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  );
  if (!headerMatch) {
    return pem;
  }

  const header = headerMatch[0];
  const footer = header.replace("BEGIN", "END");

  const body = pem
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");

  if (!body) return pem;

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
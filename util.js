const crypto = require("crypto");

function generateToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function now() {
  return new Date().toISOString();
}

module.exports = { generateToken, now };


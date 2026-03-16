// genjwt.js
import jwt from "jsonwebtoken";

const secret = "c9e8b7f6a1d2e3f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8"; // your new secret
const payload = {
  tenantId: "test-tenant",
  email: "test@example.com",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days expiry
};

const token = jwt.sign(payload, secret);

console.log("JWT_SECRET:\n" + secret + "\n");
console.log("JWT_TOKEN:\n" + token);
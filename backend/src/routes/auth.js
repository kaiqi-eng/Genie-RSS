import express from "express";
import jwt from "jsonwebtoken";
import { credentials } from "../config/index.js";

const router = express.Router();

router.post("/token", (req, res) => {
  const { email, password } = req.body;

  // Replace this with your real user validation logic!
  if (email === "test@example.com" && password === "test123") {
    const payload = {
      tenantId: "test-tenant",
      email,
      role: "admin"
    };
    const token = jwt.sign(payload, credentials.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token });
  } else {
    return res.status(401).json({ error: "Invalid credentials" });
  }
});

export default router;

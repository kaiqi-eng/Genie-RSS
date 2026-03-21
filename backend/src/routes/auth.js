import express from "express";
import { createAccessToken } from "../services/auth.js";

const router = express.Router();

/**
 * @swagger
 * /auth/token:
 *   post:
 *     summary: Create bearer token
 *     description: Validates credentials and returns a bearer token for protected routes.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 example: test123
 *     responses:
 *       200:
 *         description: Token created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tokenType:
 *                   type: string
 *                   example: Bearer
 *                 expiresIn:
 *                   type: string
 *                   nullable: true
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     tenantId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
/**
 * POST /auth/token
 * Body:
 * {
 *   "email": "test@example.com",
 *   "password": "test123"
 * }
 *
 * Uses env credentials:
 * AUTH_EMAIL
 * AUTH_PASSWORD
 *
 * Fallbacks:
 * test@example.com / test123
 */
router.post("/token", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "email and password are required",
      });
    }

    const validEmail = process.env.AUTH_EMAIL || "test@example.com";
    const validPassword = process.env.AUTH_PASSWORD || "test123";

    if (email !== validEmail || password !== validPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const user = {
      id: process.env.AUTH_USER_ID || "usr_test_001",
      tenantId: process.env.AUTH_TENANT_ID || "test-tenant",
      email,
      role: process.env.AUTH_ROLE || "admin",
      permissions: ["mcp:read", "mcp:write", "audit:read"],
    };

    const token = createAccessToken(user);

    return res.status(200).json({
      success: true,
      tokenType: "Bearer",
      expiresIn: null, // explicitly no expiry
      token,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to create token",
    });
  }
});

export default router;
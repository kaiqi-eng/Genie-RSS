import express from "express";
import { verifyBearerToken } from "../services/auth.js";
import { getTenantContext } from "../services/context.js";

const router = express.Router();

/**
 * Optional auth middleware for audit routes
 * If AUDIT_REQUIRE_AUTH=true, requires Bearer token
 */
router.use(async (req, res, next) => {
  try {
    const requireAuth = process.env.AUDIT_REQUIRE_AUTH === "true";

    if (!requireAuth) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid Authorization header",
      });
    }

    const authResult = await verifyBearerToken(authHeader);

    if (!authResult?.ok || !authResult?.user?.tenantId) {
      return res.status(401).json({
        success: false,
        error: authResult?.error || "Invalid token",
      });
    }

    req.tenant = authResult.user;
    req.context = getTenantContext(authResult.user);

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error?.message || "Unauthorized",
    });
  }
});

/**
 * GET /audit/health
 */
/**
 * @swagger
 * /audit/health:
 *   get:
 *     summary: Audit route health check
 *     description: Returns audit route status and request context metadata.
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Audit route is healthy
 *       401:
 *         description: Missing or invalid bearer token when auth is required
 */
router.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Audit route is healthy",
    tenantId: req.context?.tenantId || null,
    userId: req.tenant?.id || null,
    auditId: req.auditId || null,
  });
});

/**
 * POST /audit/test
 * A sample route to verify audit logging captures:
 * - user
 * - endpoint
 * - request
 * - response
 */
/**
 * @swagger
 * /audit/test:
 *   post:
 *     summary: Audit test endpoint
 *     description: Echoes payload and returns audit metadata for verification.
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Audit test executed
 *       401:
 *         description: Missing or invalid bearer token when auth is required
 *       500:
 *         description: Server error
 */
router.post("/test", async (req, res) => {
  try {
    const payload = req.body || {};

    const result = {
      success: true,
      message: "Audit test executed successfully",
      auditId: req.auditId || null,
      tenantId: req.context?.tenantId || req.tenant?.tenantId || null,
      userId: req.tenant?.id || null,
      received: payload,
    };

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Audit test failed",
      auditId: req.auditId || null,
    });
  }
});

export default router;
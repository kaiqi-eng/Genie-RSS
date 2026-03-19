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
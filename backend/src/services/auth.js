import jwt from "jsonwebtoken";

/**
 * Accepts either:
 * - "Bearer <token>"
 * - "<token>"
 *
 * Returns:
 * - { ok: true, user: {...} }
 * - { ok: false, error: "..." }
 */
export async function verifyBearerToken(authHeaderOrToken) {
  try {
    const rawValue = authHeaderOrToken || "";

    const token = rawValue.startsWith("Bearer ")
      ? rawValue.slice(7).trim()
      : rawValue.trim();

    if (!token) {
      return { ok: false, error: "MISSING_TOKEN" };
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return { ok: false, error: "JWT_SECRET_NOT_CONFIGURED" };
    }

    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded || !decoded.tenantId) {
      return { ok: false, error: "INVALID_TOKEN_CLAIMS" };
    }

    return {
      ok: true,
      user: {
        id: decoded.id || decoded.sub || null,
        email: decoded.email || null,
        tenantId: decoded.tenantId,
        role: decoded.role || "user",
        permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    };
  }
}
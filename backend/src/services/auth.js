import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

/**
 * Create JWT token with NO EXPIRY
 * NOTE:
 * - No expiresIn is intentionally set.
 * - This means token will remain valid until secret changes.
 */
export function createAccessToken(user) {
  const payload = {
    sub: user.id || user.email || "user",
    id: user.id || null,
    email: user.email || null,
    tenantId: user.tenantId,
    role: user.role || "user",
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };

  return jwt.sign(payload, getJwtSecret());
}

/**
 * Accepts either:
 * - "Bearer <token>"
 * - "<token>"
 *
 * Returns:
 * - { ok: true, user: {...}, token: "..." }
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

    const decoded = jwt.verify(token, getJwtSecret());

    if (!decoded || !decoded.tenantId) {
      return { ok: false, error: "INVALID_TOKEN_CLAIMS" };
    }

    return {
      ok: true,
      token,
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
// server/services/auth.js
import jwt from "jsonwebtoken";
import { credentials } from "../config/index.js";

const JWT_SECRET = credentials.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Check your .env and config/index.js");
}

function extractToken(authHeaderOrToken) {
  if (!authHeaderOrToken || typeof authHeaderOrToken !== "string") {
    return null;
  }

  if (authHeaderOrToken.startsWith("Bearer ")) {
    return authHeaderOrToken.slice(7).trim();
  }

  return authHeaderOrToken.trim();
}

export async function verifyBearerToken(authHeaderOrToken) {
  try {
    const token = extractToken(authHeaderOrToken);

    if (!token) {
      return { ok: false, error: "MISSING_TOKEN" };
    }

    console.log("JWT_SECRET loaded?", !!JWT_SECRET);

    const decoded = jwt.verify(token, JWT_SECRET);

    console.log("JWT decoded payload:", decoded);

    if (!decoded?.tenantId) {
      return { ok: false, error: "INVALID_TOKEN_CLAIMS" };
    }

    return {
      ok: true,
      user: {
        id: decoded.id ?? decoded.userId ?? decoded.email ?? null,
        email: decoded.email ?? null,
        tenantId: decoded.tenantId,
        role: decoded.role ?? "user",
        permissions: decoded.permissions ?? [],
      },
    };
  } catch (err) {
    console.error("JWT VERIFY ERROR:", err.name, err.message);

    if (err.name === "TokenExpiredError") {
      return { ok: false, error: "TOKEN_EXPIRED" };
    }

    if (err.name === "JsonWebTokenError") {
      return { ok: false, error: `INVALID_TOKEN: ${err.message}` };
    }

    return { ok: false, error: `AUTH_VERIFICATION_FAILED: ${err.message}` };
  }
}

export function getTenantContext(userOrTenantId) {
  let tenantId = null;
  let userId = null;
  let role = "user";
  let permissions = [];

  if (typeof userOrTenantId === "string") {
    tenantId = userOrTenantId;
  } else if (userOrTenantId && typeof userOrTenantId === "object") {
    tenantId = userOrTenantId.tenantId;
    userId = userOrTenantId.id ?? null;
    role = userOrTenantId.role ?? "user";
    permissions = userOrTenantId.permissions ?? [];
  }

  if (!tenantId) {
    throw new Error("Missing tenantId for tenant context");
  }

  return {
    tenantId,
    userId,
    role,
    permissions,
  };
}
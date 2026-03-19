import fs from "fs";
import path from "path";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "authorization",
  "authToken",
  "jwt",
]);

function sanitizeData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((item) => sanitizeData(item));

  const copy = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      copy[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      copy[key] = sanitizeData(value);
    } else {
      copy[key] = value;
    }
  }
  return copy;
}

/**
 * Structured audit logger
 * Recommended for Render.com:
 * - Console logs are primary
 * - Optional file logs if AUDIT_WRITE_FILE=true
 */
export function logAudit({
  auditId,
  tenantId = null,
  userId = null,
  email = null,
  endpoint = "unknown",
  method = "unknown",
  request = null,
  response = null,
  status = "unknown",
  error = null,
  httpStatus = null,
  durationMs = null,
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    auditId: auditId || null,
    tenantId,
    userId,
    email,
    endpoint,
    method,
    status,
    httpStatus,
    durationMs,
    request: sanitizeData(request),
    response: sanitizeData(response),
    error: error ? String(error) : null,
  };

  const line = JSON.stringify(entry);

  // Primary: Render logs
  console.log(line);

  // Optional file log (not recommended as primary on Render)
  if (process.env.AUDIT_WRITE_FILE === "true") {
    try {
      const logFile = path.resolve("./audit.log");
      fs.appendFileSync(logFile, line + "\n", { encoding: "utf8" });
    } catch (fileError) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          type: "audit_file_write_failed",
          error: fileError?.message || String(fileError),
        })
      );
    }
  }

  return entry;
}

export function safeLogAudit(payload) {
  try {
    return logAudit(payload);
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "audit_logging_failed",
        error: error?.message || String(error),
      })
    );
    return null;
  }
}

/**
 * Express middleware to audit every request/response
 * Captures:
 * - user / tenant
 * - endpoint
 * - request body
 * - response body
 * - HTTP status
 * - duration
 */
export function createAuditMiddleware() {
  return (req, res, next) => {
    const auditId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const startedAt = Date.now();

    req.auditId = auditId;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let responsePayload = null;

    res.json = (body) => {
      responsePayload = body;
      return originalJson(body);
    };

    res.send = (body) => {
      if (responsePayload === null) {
        responsePayload = body;
      }
      return originalSend(body);
    };

    res.on("finish", () => {
      safeLogAudit({
        auditId,
        tenantId: req.context?.tenantId || req.tenant?.tenantId || null,
        userId: req.tenant?.id || null,
        email: req.tenant?.email || null,
        endpoint: req.originalUrl || req.url || "unknown",
        method: req.method || "unknown",
        request:
          req.method === "GET"
            ? { query: req.query }
            : { body: req.body, query: req.query },
        response: responsePayload,
        status: res.statusCode >= 400 ? "fail" : "success",
        httpStatus: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  };
}
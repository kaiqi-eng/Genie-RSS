import fs from "fs";
import path from "path";

/**
 * Sanitize request/response data before logging
 */
function sanitizeData(data = {}) {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((item) => sanitizeData(item));

  const copy = { ...data };
  const sensitiveKeys = [
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "apiKey",
    "secret",
    "authorization",
    "authToken",
    "jwt",
  ];

  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.includes(key)) {
      copy[key] = "[REDACTED]";
    } else if (typeof copy[key] === "object" && copy[key] !== null) {
      copy[key] = sanitizeData(copy[key]);
    }
  }

  return copy;
}

/**
 * Main audit logger
 * Writes to console + file (audit.log)
 */
export function logAudit(
  tenantId,
  endpoint,
  method,
  requestData,
  auditId,
  status,
  responseData = null,
  error = null
) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      tenantId: tenantId || null,
      endpoint: endpoint || "unknown",
      method: method || "unknown",
      request: sanitizeData(requestData || {}),
      response: sanitizeData(responseData),
      auditId: auditId || null,
      status: status || "unknown",
      error: error || null,
    };

    const logLine = JSON.stringify(entry);

    // 1. Console log
    console.log(logLine);

    // 2. Write to file (append)
    const logFile = path.resolve("./audit.log");
    fs.appendFileSync(logFile, logLine + "\n", { encoding: "utf8" });
  } catch (logError) {
    console.error("Audit logging failed:", logError?.message || logError);
  }
}

/**
 * Safe wrapper for audit logging
 */
export function safeLogAudit(
  tenantId,
  endpoint,
  method,
  requestData,
  auditId,
  status,
  responseData = null,
  error = null
) {
  try {
    logAudit(
      tenantId,
      endpoint,
      method,
      requestData,
      auditId,
      status,
      responseData,
      error
    );
  } catch {
    // intentionally ignore
  }
}
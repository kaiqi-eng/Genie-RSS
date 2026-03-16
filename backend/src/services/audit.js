import fs from "fs";
import path from "path";

const AUDIT_LOG_PATH = path.resolve(process.cwd(), "audit.log");

// Stub for audit logging
export function logAudit(tenantId, method, params, auditId, status = "success", error = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    tenantId,
    method,
    params,
    auditId,
    status,
    error
  };
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(AUDIT_LOG_PATH, line, { encoding: "utf8" });
}
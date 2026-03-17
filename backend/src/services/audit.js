/**
 * Basic audit logger
 * Replace with DB/file logger if needed.
 */
export function logAudit(tenantId, method, params, auditId, status, error = null) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      tenantId: tenantId || null,
      method: method || "unknown",
      params: params || {},
      auditId,
      status,
      error: error || null,
    };

    console.log(JSON.stringify(entry));
  } catch (logError) {
    console.error("Audit logging failed:", logError?.message || logError);
  }
}

/**
 * Optional safe alias if some files use safeLogAudit instead of logAudit
 */
export function safeLogAudit(tenantId, method, params, auditId, status, error = null) {
  try {
    logAudit(tenantId, method, params, auditId, status, error);
  } catch {
    // intentionally ignore
  }
}
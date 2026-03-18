import crypto from "crypto";
import { safeLogAudit } from "./auditLogger.js";

app.post("/api/users/create", async (req, res) => {
  const auditId = crypto.randomUUID();
  const tenantId = req.user?.tenantId || null;

  safeLogAudit(
    tenantId,
    req.originalUrl,
    req.method,
    req.body,
    auditId,
    "started"
  );

  try {
    const result = {
      success: true,
      userId: "usr_001",
      message: "User created successfully",
    };

    safeLogAudit(
      tenantId,
      req.originalUrl,
      req.method,
      req.body,
      auditId,
      "success",
      result
    );

    res.status(200).json(result);
  } catch (error) {
    safeLogAudit(
      tenantId,
      req.originalUrl,
      req.method,
      req.body,
      auditId,
      "failed",
      null,
      error?.message || String(error)
    );

    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { EventEmitter } from "events";
import * as auditService from "../../src/services/audit.js";

describe("Audit Service", () => {
  const originalAuditWriteFile = process.env.AUDIT_WRITE_FILE;

  beforeEach(() => {
    process.env.AUDIT_WRITE_FILE = "false";
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalAuditWriteFile === undefined) {
      delete process.env.AUDIT_WRITE_FILE;
    } else {
      process.env.AUDIT_WRITE_FILE = originalAuditWriteFile;
    }
    jest.restoreAllMocks();
  });

  it("sanitizes sensitive fields in audit logs", () => {
    const entry = auditService.logAudit({
      auditId: "audit_1",
      endpoint: "/audit/test",
      method: "POST",
      request: {
        password: "secret",
        nested: { token: "abc123", keep: "ok" },
      },
      response: { accessToken: "jwt", data: "safe" },
      status: "success",
    });

    expect(entry.request.password).toBe("[REDACTED]");
    expect(entry.request.nested.token).toBe("[REDACTED]");
    expect(entry.request.nested.keep).toBe("ok");
    expect(entry.response.accessToken).toBe("[REDACTED]");
  });

  it("safeLogAudit returns null if logging crashes", () => {
    const circular = {};
    circular.self = circular;

    const result = auditService.safeLogAudit({
      auditId: "audit_fail",
      request: circular,
    });

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("createAuditMiddleware sets auditId and logs on finish", () => {
    const middleware = auditService.createAuditMiddleware();
    const res = new EventEmitter();

    res.statusCode = 200;
    res.json = jest.fn((body) => body);
    res.send = jest.fn((body) => body);

    const req = {
      method: "POST",
      originalUrl: "/audit/test",
      body: { hello: "world", token: "sensitive" },
      query: {},
      context: { tenantId: "tenant_1" },
      tenant: { id: "usr_1", email: "user@example.com", tenantId: "tenant_1" },
    };

    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(typeof req.auditId).toBe("string");

    res.json({ ok: true });
    res.emit("finish");

    expect(console.log).toHaveBeenCalled();
    const loggedEntry = JSON.parse(console.log.mock.calls[0][0]);
    expect(loggedEntry.auditId).toBe(req.auditId);
    expect(loggedEntry.endpoint).toBe("/audit/test");
    expect(loggedEntry.request.body.token).toBe("[REDACTED]");
    expect(loggedEntry.response).toEqual({ ok: true });
  });
});

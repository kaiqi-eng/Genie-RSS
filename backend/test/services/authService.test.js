import { describe, it, expect, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import { createAccessToken, verifyBearerToken } from "../../src/services/auth.js";

describe("Auth Service", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "auth-service-test-secret";
  });

  describe("createAccessToken", () => {
    it("creates token with expected claims", () => {
      const token = createAccessToken({
        id: "usr_123",
        email: "user@example.com",
        tenantId: "tenant_123",
        role: "admin",
        permissions: ["mcp:read"],
      });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe("usr_123");
      expect(decoded.email).toBe("user@example.com");
      expect(decoded.tenantId).toBe("tenant_123");
      expect(decoded.role).toBe("admin");
      expect(decoded.permissions).toEqual(["mcp:read"]);
    });

    it("throws when JWT_SECRET is missing", () => {
      delete process.env.JWT_SECRET;
      expect(() =>
        createAccessToken({ id: "usr_1", tenantId: "tenant_1" })
      ).toThrow("JWT_SECRET is not configured");
    });
  });

  describe("verifyBearerToken", () => {
    it("accepts Bearer token and returns normalized user", async () => {
      const token = createAccessToken({
        id: "usr_99",
        email: "auth@example.com",
        tenantId: "tenant_99",
      });

      const result = await verifyBearerToken(`Bearer ${token}`);

      expect(result.ok).toBe(true);
      expect(result.user.id).toBe("usr_99");
      expect(result.user.tenantId).toBe("tenant_99");
      expect(result.user.email).toBe("auth@example.com");
    });

    it("returns MISSING_TOKEN for empty input", async () => {
      const result = await verifyBearerToken("");
      expect(result).toEqual({ ok: false, error: "MISSING_TOKEN" });
    });

    it("returns INVALID_TOKEN_CLAIMS when tenantId is missing", async () => {
      const token = jwt.sign({ id: "usr_no_tenant" }, process.env.JWT_SECRET);
      const result = await verifyBearerToken(token);

      expect(result).toEqual({ ok: false, error: "INVALID_TOKEN_CLAIMS" });
    });

    it("returns INVALID_TOKEN for malformed token", async () => {
      const result = await verifyBearerToken("not-a-jwt");
      expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
    });
  });
});

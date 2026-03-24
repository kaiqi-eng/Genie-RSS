import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../src/index.js";
import { createAccessToken } from "../../src/services/auth.js";

describe("Audit Routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "audit-test-secret";
    delete process.env.AUDIT_REQUIRE_AUTH;
  });

  describe("GET /audit/health", () => {
    it("works when auth is optional", async () => {
      const res = await request(app).get("/audit/health").expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/healthy/i);
    });

    it("requires bearer token when AUDIT_REQUIRE_AUTH=true", async () => {
      process.env.AUDIT_REQUIRE_AUTH = "true";

      const res = await request(app).get("/audit/health").expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authorization header/i);
    });

    it("accepts valid bearer token when auth is required", async () => {
      process.env.AUDIT_REQUIRE_AUTH = "true";
      const token = createAccessToken({
        id: "usr_1",
        email: "user@example.com",
        tenantId: "tenant_1",
      });

      const res = await request(app)
        .get("/audit/health")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.tenantId).toBe("tenant_1");
      expect(res.body.userId).toBe("usr_1");
    });
  });

  describe("POST /audit/test", () => {
    it("echoes payload and metadata", async () => {
      const payload = { hello: "world" };
      const res = await request(app).post("/audit/test").send(payload).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.received).toEqual(payload);
      expect(typeof res.body.auditId).toBe("string");
    });
  });
});

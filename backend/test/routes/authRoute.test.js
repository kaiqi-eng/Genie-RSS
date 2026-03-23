import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../../src/index.js";

describe("Auth Routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "route-auth-test-secret";
    delete process.env.AUTH_EMAIL;
    delete process.env.AUTH_PASSWORD;
  });

  describe("POST /auth/token", () => {
    it("requires email and password", async () => {
      const res = await request(app).post("/auth/token").send({}).expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/required/i);
    });

    it("rejects invalid credentials", async () => {
      const res = await request(app)
        .post("/auth/token")
        .send({ email: "wrong@example.com", password: "nope" })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("returns token on valid default credentials", async () => {
      const res = await request(app)
        .post("/auth/token")
        .send({ email: "test@example.com", password: "test123" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.tokenType).toBe("Bearer");
      expect(typeof res.body.token).toBe("string");
      expect(res.body.user.email).toBe("test@example.com");
    });

    it("uses AUTH_EMAIL and AUTH_PASSWORD when configured", async () => {
      process.env.AUTH_EMAIL = "admin@example.com";
      process.env.AUTH_PASSWORD = "super-secret";

      await request(app)
        .post("/auth/token")
        .send({ email: "test@example.com", password: "test123" })
        .expect(401);

      const successRes = await request(app)
        .post("/auth/token")
        .send({ email: "admin@example.com", password: "super-secret" })
        .expect(200);

      expect(successRes.body.success).toBe(true);
      expect(successRes.body.user.email).toBe("admin@example.com");
    });
  });
});

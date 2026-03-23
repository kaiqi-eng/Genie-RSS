import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { API_KEY } from "../helpers/api.js";

process.env.WEBHOOK_URL = "https://webhook.example";

const mockAxiosPost = jest.fn();

jest.unstable_mockModule("axios", () => ({
  default: {
    post: mockAxiosPost,
  },
}));

const { default: app } = await import("../../src/index.js");

describe("Intel Routes", () => {
  beforeEach(() => {
    mockAxiosPost.mockReset();
  });

  describe("POST /api/intel/addintelurl", () => {
    it("requires API key", async () => {
      await request(app)
        .post("/api/intel/addintelurl")
        .send({ urls: ["https://example.com"] })
        .expect(401);
    });

    it("validates request body", async () => {
      const res = await request(app)
        .post("/api/intel/addintelurl")
        .set("X-API-Key", API_KEY)
        .send({})
        .expect(400);

      expect(res.body.error).toBe("Validation failed");
    });

    it("returns combined results for valid and blocked urls", async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { accepted: true } });

      const res = await request(app)
        .post("/api/intel/addintelurl")
        .set("X-API-Key", API_KEY)
        .send({ urls: ["http://localhost:3000", "https://example.com"] })
        .expect(200);

      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[1].success).toBe(true);
    });
  });

  describe("POST /api/intel/deleteintelurl", () => {
    it("captures webhook failures per URL", async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error("webhook down"));

      const res = await request(app)
        .post("/api/intel/deleteintelurl")
        .set("X-API-Key", API_KEY)
        .send({ urls: ["https://example.com"] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results[0].success).toBe(false);
      expect(String(res.body.results[0].error)).toMatch(/webhook down/i);
    });
  });

  describe("POST /api/intel/getdailyintel", () => {
    it("returns webhook payload", async () => {
      mockAxiosPost.mockResolvedValueOnce({ data: { items: [{ id: 1 }] } });

      const res = await request(app)
        .post("/api/intel/getdailyintel")
        .set("X-API-Key", API_KEY)
        .send({ date: "2026-01-01" })
        .expect(200);

      expect(mockAxiosPost).toHaveBeenCalledWith(
        "https://webhook.example/getdailyintel",
        { params: { date: "2026-01-01" } }
      );
      expect(res.body.items).toHaveLength(1);
    });

    it("returns 500 on webhook error", async () => {
      mockAxiosPost.mockRejectedValueOnce(new Error("daily intel failed"));

      const res = await request(app)
        .post("/api/intel/getdailyintel")
        .set("X-API-Key", API_KEY)
        .send({ date: "2026-01-01" })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(String(res.body.error)).toMatch(/daily intel failed/i);
    });
  });
});

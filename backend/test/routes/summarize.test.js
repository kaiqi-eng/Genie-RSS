import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { API_KEY } from "../helpers/api.js";
import { sampleFeedItems } from "../helpers/payloads.js";

const mockSummarizeFeeds = jest.fn();

jest.unstable_mockModule("../../src/services/feedSummarizer.js", () => ({
  summarizeFeeds: mockSummarizeFeeds,
}));

const { default: app } = await import("../../src/index.js");

describe("Summarize Routes", () => {
  beforeEach(() => {
    mockSummarizeFeeds.mockReset();
  });

  describe("POST /api/summarize", () => {
    it("requires API key", async () => {
      await request(app).post("/api/summarize").send({ feeds: sampleFeedItems }).expect(401);
    });

    it("validates request body", async () => {
      const res = await request(app)
        .post("/api/summarize")
        .set("X-API-Key", API_KEY)
        .send({})
        .expect(400);

      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details[0].field).toBe("feeds");
    });

    it("returns summarize result on success", async () => {
      mockSummarizeFeeds.mockResolvedValueOnce({
        summary: "Concise summary",
        items: [{ title: "Example item" }],
      });

      const res = await request(app)
        .post("/api/summarize")
        .set("X-API-Key", API_KEY)
        .send({ feeds: sampleFeedItems })
        .expect(200);

      expect(mockSummarizeFeeds).toHaveBeenCalledWith(sampleFeedItems);
      expect(res.body.status).toBe("success");
      expect(res.body.summary).toBe("Concise summary");
    });

    it("returns 500 when summarizer fails", async () => {
      mockSummarizeFeeds.mockRejectedValueOnce(new Error("summarizer unavailable"));

      const res = await request(app)
        .post("/api/summarize")
        .set("X-API-Key", API_KEY)
        .send({ feeds: sampleFeedItems })
        .expect(500);

      expect(res.body.error).toBe("summarizer unavailable");
    });
  });
});

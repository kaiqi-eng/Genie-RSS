import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { API_KEY } from "../helpers/api.js";

const mockProcessFeeds = jest.fn();

jest.unstable_mockModule("../../src/services/feedprocess.js", () => ({
  processFeeds: mockProcessFeeds,
}));

const { default: app } = await import("../../src/index.js");

describe("Feed Routes", () => {
  beforeEach(() => {
    mockProcessFeeds.mockReset();
  });

  describe("POST /api/rss/feed/processfeed", () => {
    it("requires API key", async () => {
      await request(app)
        .post("/api/rss/feed/processfeed")
        .send({ feeds: ["https://example.com/feed.xml"] })
        .expect(401);
    });

    it("validates request body", async () => {
      const res = await request(app)
        .post("/api/rss/feed/processfeed")
        .set("X-API-Key", API_KEY)
        .send({})
        .expect(400);

      expect(res.body.error).toBe("Validation failed");
    });

    it("returns processed feeds", async () => {
      mockProcessFeeds.mockResolvedValueOnce({
        feed: { items: [{ title: "A" }] },
        total_items: 1,
        engine: "test-engine",
      });

      const res = await request(app)
        .post("/api/rss/feed/processfeed")
        .set("X-API-Key", API_KEY)
        .send({ feeds: ["https://example.com/feed.xml"] })
        .expect(200);

      expect(mockProcessFeeds).toHaveBeenCalledWith({
        feeds: ["https://example.com/feed.xml"],
      });
      expect(res.body.feed.items).toHaveLength(1);
      expect(res.body.total_items).toBe(1);
    });

    it("maps service errors to 500", async () => {
      mockProcessFeeds.mockRejectedValueOnce(new Error("feed process failed"));

      const res = await request(app)
        .post("/api/rss/feed/processfeed")
        .set("X-API-Key", API_KEY)
        .send({ feeds: ["https://example.com/feed.xml"] })
        .expect(500);

      expect(res.body.error).toBe("feed process failed");
    });
  });
});

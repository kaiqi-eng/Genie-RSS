import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { createAccessToken } from "../../src/services/auth.js";

const mockProcessFeeds = jest.fn();
const mockSummarizeFeeds = jest.fn();

jest.unstable_mockModule("../../src/services/feedprocess.js", () => ({
  processFeeds: mockProcessFeeds,
}));

jest.unstable_mockModule("../../src/services/feedSummarizer.js", () => ({
  summarizeFeeds: mockSummarizeFeeds,
}));

const { default: app } = await import("../../src/index.js");

describe("MCP Routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "mcp-test-secret";
    mockProcessFeeds.mockReset();
    mockSummarizeFeeds.mockReset();
  });

  function bearerToken() {
    return createAccessToken({
      id: "usr_mcp",
      email: "mcp@example.com",
      tenantId: "tenant_mcp",
      permissions: ["mcp:read", "mcp:write"],
    });
  }

  it("requires bearer token", async () => {
    const res = await request(app).get("/mcp/health").expect(401);

    expect(res.body.error.code).toBe(-32001);
  });

  it("returns health when authenticated", async () => {
    const res = await request(app)
      .get("/mcp/health")
      .set("Authorization", `Bearer ${bearerToken()}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.tenantId).toBe("tenant_mcp");
  });

  it("supports tools/list", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${bearerToken()}`)
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list" })
      .expect(200);

    expect(res.body.result.tools.length).toBeGreaterThan(0);
    expect(res.body.result.tools[0].name).toBe("fetch_rss_feed");
  });

  it("supports tools/call fetch_rss_feed", async () => {
    mockProcessFeeds.mockResolvedValueOnce({ feed: { items: [] }, total_items: 0 });

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${bearerToken()}`)
      .send({
        jsonrpc: "2.0",
        id: "req-1",
        method: "tools/call",
        params: { name: "fetch_rss_feed", args: { url: "https://example.com/feed.xml" } },
      })
      .expect(200);

    expect(mockProcessFeeds).toHaveBeenCalledWith({ url: "https://example.com/feed.xml" });
    expect(res.body.result.total_items).toBe(0);
  });

  it("validates feed_summary params", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${bearerToken()}`)
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "feed_summary", args: { feeds: [] } },
      })
      .expect(400);

    expect(res.body.error.code).toBe(-32602);
  });

  it("returns 404 for unknown method", async () => {
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${bearerToken()}`)
      .send({ jsonrpc: "2.0", id: 3, method: "unknown/method" })
      .expect(404);

    expect(res.body.error.code).toBe(-32601);
  });

  it("returns 500 when tool call throws", async () => {
    mockProcessFeeds.mockRejectedValueOnce(new Error("mcp tool failed"));

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${bearerToken()}`)
      .send({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "fetch_rss_feed", args: { url: "https://example.com/feed.xml" } },
      })
      .expect(500);

    expect(res.body.error.code).toBe(-32000);
    expect(res.body.error.message).toBe("mcp tool failed");
  });
});

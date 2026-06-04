import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import zlib from "zlib";

const mockAxiosGet = jest.fn();
const mockImapConnect = jest.fn();

jest.unstable_mockModule("axios", () => ({
  default: {
    get: mockAxiosGet,
  },
}));

jest.unstable_mockModule("imap-simple", () => ({
  default: {
    connect: mockImapConnect,
  },
}));

const {
  hashId,
  parseRSS,
  fetchDirect,
  processFeeds,
} = await import("../../src/services/feedprocess.js");

describe("Feed Process Service", () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockImapConnect.mockReset();
  });

  it("hashId is deterministic and unique by input", () => {
    const a = hashId("url-a", "date-a");
    const b = hashId("url-a", "date-a");
    const c = hashId("url-b", "date-a");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("parseRSS parses RSS XML items", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Item One</title>
          <link>https://example.com/item-1</link>
          <description>Hello world</description>
          <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;

    const items = await parseRSS(xml, "https://example.com/feed.xml", "direct");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Item One");
    expect(items[0].url).toBe("https://example.com/item-1");
    expect(items[0].source).toBe("https://example.com/feed.xml");
  });

  it("fetchDirect handles gzipped responses", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Gzip Item</title>
          <link>https://example.com/gzip</link>
          <description>Compressed content</description>
          <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;
    const gzipped = zlib.gzipSync(Buffer.from(xml, "utf-8"));

    mockAxiosGet.mockResolvedValueOnce({
      data: gzipped,
      headers: { "content-encoding": "gzip" },
    });

    const items = await fetchDirect("https://example.com/feed.xml");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Gzip Item");
  });

  it("processFeeds validates input", async () => {
    await expect(processFeeds({})).rejects.toThrow(
      "feeds must be a non-empty array or url must be provided"
    );
  });

  it("processFeeds returns normalized output shape", async () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Processed Item</title>
          <link>https://example.com/processed</link>
          <description>Processed content</description>
          <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `;

    mockAxiosGet.mockResolvedValueOnce({
      data: Buffer.from(xml, "utf-8"),
      headers: {},
    });

    const result = await processFeeds({ url: "https://example.com/feed.xml" });

    expect(result.feed.items).toHaveLength(1);
    expect(result.total_items).toBe(1);
    expect(result.engine).toMatch(/Third Eye/i);
    expect(typeof result.timestamp).toBe("string");
  });
});

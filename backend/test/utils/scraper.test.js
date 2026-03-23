import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockAxiosGet = jest.fn();

jest.unstable_mockModule("axios", () => ({
  default: {
    get: mockAxiosGet,
  },
}));

const { scrapeWebsite } = await import("../../src/utils/scraper.js");

describe("Scraper Utils", () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
  });

  it("rejects blocked URLs via SSRF validation", async () => {
    await expect(scrapeWebsite("http://localhost:3000")).rejects.toThrow();
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it("scrapes page metadata and items", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: `
        <html>
          <head>
            <title>Example Blog</title>
            <meta name="description" content="A sample blog" />
            <link rel="icon" href="/favicon.png" />
          </head>
          <body>
            <article>
              <h2>First Post</h2>
              <a href="/posts/1">Read</a>
              <p>Intro paragraph</p>
              <time datetime="2026-01-15T00:00:00.000Z"></time>
            </article>
          </body>
        </html>
      `,
    });

    const result = await scrapeWebsite("https://example.com");

    expect(result.title).toBe("Example Blog");
    expect(result.description).toBe("A sample blog");
    expect(result.favicon).toBe("https://example.com/favicon.png");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("First Post");
    expect(result.items[0].link).toBe("https://example.com/posts/1");
  });

  it("wraps axios errors with scraper context", async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error("network down"));

    await expect(scrapeWebsite("https://example.com")).rejects.toThrow(
      "Failed to scrape website: network down"
    );
  });
});

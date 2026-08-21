import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const CNBC_FEED_URL = 'https://www.cnbc.com/id/100003114/device/rss/rss.html';
const CNBC_GUID = '108351816';
const CNBC_ARTICLE_URL = 'https://www.cnbc.com/2026/08/20/cnbc-regression-article.html';

const mockParseURL = jest.fn();
const mockAxiosGet = jest.fn();

jest.unstable_mockModule('rss-parser', () => ({
  default: class MockParser {
    parseURL(...args) {
      return mockParseURL(...args);
    }
  }
}));

jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet }
}));

const { fetchAndParseRss, invalidateAllFeedCache } = await import('../../src/services/rssFetcher.js');

describe('RSS Fetcher CNBC link-only enrichment', () => {
  beforeEach(() => {
    mockParseURL.mockReset();
    mockAxiosGet.mockReset();
    invalidateAllFeedCache();
  });

  it('enriches CNBC GUID 108351816 from its article URL when the RSS item has no body', async () => {
    mockParseURL.mockResolvedValueOnce({
      title: 'CNBC US Top News and Analysis',
      items: [
        {
          title: 'CNBC article represented by GUID 108351816',
          guid: CNBC_GUID,
          link: CNBC_ARTICLE_URL,
          pubDate: 'Thu, 20 Aug 2026 12:00:00 GMT'
        }
      ]
    });
    mockAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: `
        <html><head>
          <script type="application/ld+json">
            {"@type":"NewsArticle","articleBody":"CNBC article body extracted from JSON-LD contains enough readable prose for ingestion."}
          </script>
        </head></html>
      `
    });

    const result = await fetchAndParseRss(CNBC_FEED_URL, { bypassCache: true });

    expect(result.itemFailures).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      guid: CNBC_GUID,
      title: 'CNBC article represented by GUID 108351816',
      link: CNBC_ARTICLE_URL,
      pubDate: 'Thu, 20 Aug 2026 12:00:00 GMT',
      extractionMethod: 'json-ld.articleBody'
    });
    expect(result.items[0].content.length).toBeGreaterThanOrEqual(10);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      CNBC_ARTICLE_URL,
      expect.objectContaining({ responseType: 'text' })
    );
  });

  it('returns a per-item failure without discarding valid enriched CNBC items', async () => {
    mockParseURL.mockResolvedValueOnce({
      title: 'CNBC US Top News and Analysis',
      items: [
        {
          title: 'Enriched CNBC article',
          guid: CNBC_GUID,
          link: CNBC_ARTICLE_URL,
          pubDate: 'Thu, 20 Aug 2026 12:00:00 GMT'
        },
        {
          title: 'Blocked CNBC article',
          guid: 'blocked-guid',
          link: 'https://www.cnbc.com/2026/08/20/blocked.html'
        }
      ]
    });
    mockAxiosGet
      .mockResolvedValueOnce({
        status: 200,
        data: '<article class="ArticleBody-articleBody"><p>Readable CNBC selector content for a valid item.</p></article>'
      })
      .mockRejectedValueOnce({
        message: 'Request failed with status code 403',
        response: { status: 403, data: 'Forbidden' }
      });

    const result = await fetchAndParseRss(CNBC_FEED_URL, { bypassCache: true });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].guid).toBe(CNBC_GUID);
    expect(result.items[0].content.length).toBeGreaterThanOrEqual(10);
    expect(result.itemFailures).toEqual([
      expect.objectContaining({
        guid: 'blocked-guid',
        url: 'https://www.cnbc.com/2026/08/20/blocked.html',
        httpStatus: 403,
        extractionMethod: expect.stringContaining('json-ld.articleBody'),
        responseBodySize: 9,
        extractedContentLength: 0
      })
    ]);
  });
});

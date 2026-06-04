import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockParseURL = jest.fn();

jest.unstable_mockModule('rss-parser', () => ({
  default: class MockParser {
    parseURL(...args) {
      return mockParseURL(...args);
    }
  }
}));

const { fetchAndParseRss, invalidateAllFeedCache } = await import('../../src/services/rssFetcher.js');

describe('RSS Fetcher YouTube Content Extraction', () => {
  beforeEach(() => {
    mockParseURL.mockReset();
    invalidateAllFeedCache();
  });

  it('extracts media group description when item content is missing', async () => {
    mockParseURL.mockResolvedValueOnce({
      title: 'YouTube Channel',
      link: 'https://www.youtube.com/feeds/videos.xml?channel_id=test',
      items: [
        {
          title: 'Video with media description',
          link: 'https://www.youtube.com/watch?v=abc',
          pubDate: '2026-03-20T00:00:00Z',
          mediaGroup: {
            'media:description': [{ _: 'This description comes from media group.' }],
            'media:thumbnail': [{ $: { url: 'https://i.ytimg.com/vi/abc/default.jpg' } }]
          }
        }
      ]
    });

    const result = await fetchAndParseRss(
      'https://www.youtube.com/feeds/videos.xml?channel_id=test',
      { bypassCache: true }
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('This description comes from media group.');
    expect(result.items[0].contentSnippet).toContain('This description comes from media group.');
    expect(result.items[0].thumbnail).toBe('https://i.ytimg.com/vi/abc/default.jpg');
  });
});

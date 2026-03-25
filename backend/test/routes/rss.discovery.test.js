import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

const API_KEY = process.env.API_KEY || 'test-api-key-12345';

const mockDiscoverRssFeed = jest.fn();
const mockFetchAndParseRss = jest.fn();
const mockScrapeWebsite = jest.fn();
const mockGenerateRssFeed = jest.fn();

jest.unstable_mockModule('../../src/services/rssDiscovery.js', () => ({
  discoverRssFeed: mockDiscoverRssFeed
}));

jest.unstable_mockModule('../../src/services/rssFetcher.js', () => ({
  fetchAndParseRss: mockFetchAndParseRss
}));

jest.unstable_mockModule('../../src/utils/scraper.js', () => ({
  scrapeWebsite: mockScrapeWebsite
}));

jest.unstable_mockModule('../../src/services/rssGenerator.js', () => ({
  generateRssFeed: mockGenerateRssFeed
}));

const { default: app } = await import('../../src/index.js');

describe('RSS Route Discovery Path', () => {
  beforeEach(() => {
    mockDiscoverRssFeed.mockReset();
    mockFetchAndParseRss.mockReset();
    mockScrapeWebsite.mockReset();
    mockGenerateRssFeed.mockReset();
  });

  it('uses discovered parser path for direct YouTube feed URL and returns multiple items', async () => {
    const youtubeFeedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnYMOamNKLGVlJgRUbamveA';
    mockDiscoverRssFeed.mockResolvedValueOnce(youtubeFeedUrl);
    mockFetchAndParseRss.mockResolvedValueOnce({
      title: 'YouTube Channel',
      items: [
        { title: 'Video A', link: 'https://youtube.com/watch?v=a' },
        { title: 'Video B', link: 'https://youtube.com/watch?v=b' }
      ]
    });

    const res = await request(app)
      .post('/api/rss/fetch')
      .set('X-API-Key', API_KEY)
      .send({ url: youtubeFeedUrl })
      .expect(200);

    expect(res.body.source).toBe('discovered');
    expect(res.body.feedUrl).toBe(youtubeFeedUrl);
    expect(Array.isArray(res.body.feed.items)).toBe(true);
    expect(res.body.feed.items).toHaveLength(2);
    expect(mockDiscoverRssFeed).toHaveBeenCalledWith(youtubeFeedUrl);
    expect(mockFetchAndParseRss).toHaveBeenCalledWith(
      youtubeFeedUrl,
      expect.objectContaining({ since: undefined })
    );
    expect(mockScrapeWebsite).not.toHaveBeenCalled();
    expect(mockGenerateRssFeed).not.toHaveBeenCalled();
  });
});

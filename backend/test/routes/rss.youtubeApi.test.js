import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';

const API_KEY = process.env.API_KEY || 'test-api-key-12345';

const mockDiscoverRssFeed = jest.fn();
const mockFetchAndParseRss = jest.fn();
const mockScrapeWebsite = jest.fn();
const mockGenerateRssFeed = jest.fn();
const mockIsYouTubeUrl = jest.fn();
const mockBuildYouTubeFeedFromUrl = jest.fn();

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

jest.unstable_mockModule('../../src/services/youtubeFeedService.js', () => ({
  isYouTubeUrl: mockIsYouTubeUrl,
  buildYouTubeFeedFromUrl: mockBuildYouTubeFeedFromUrl,
  YouTubeFeedError: class YouTubeFeedError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.statusCode = options.statusCode;
      this.code = options.code;
    }
  }
}));

const { default: app } = await import('../../src/index.js');

describe('RSS Route YouTube API path', () => {
  beforeEach(() => {
    mockDiscoverRssFeed.mockReset();
    mockFetchAndParseRss.mockReset();
    mockScrapeWebsite.mockReset();
    mockGenerateRssFeed.mockReset();
    mockIsYouTubeUrl.mockReset();
    mockBuildYouTubeFeedFromUrl.mockReset();
  });

  it('prefers direct YouTube RSS fetch when available', async () => {
    const url = 'https://www.youtube.com/channel/UCORX3Cl7ByidjEgzSCgv9Yw';
    mockIsYouTubeUrl.mockReturnValueOnce(true);
    mockDiscoverRssFeed.mockResolvedValueOnce('https://www.youtube.com/feeds/videos.xml?channel_id=UCORX3Cl7ByidjEgzSCgv9Yw');
    mockFetchAndParseRss.mockResolvedValueOnce({
      title: 'RSS Feed',
      items: [{ title: 'RSS Video A', link: 'https://www.youtube.com/watch?v=FQhoQ4bRbe8' }],
    });

    const res = await request(app)
      .post('/api/rss/fetch')
      .set('X-API-Key', API_KEY)
      .send({ url })
      .expect(200);

    expect(res.body.source).toBe('discovered');
    expect(res.body.feedUrl).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCORX3Cl7ByidjEgzSCgv9Yw');
    expect(res.body.feed.items).toHaveLength(1);
    expect(mockDiscoverRssFeed).toHaveBeenCalledWith(url);
    expect(mockFetchAndParseRss).toHaveBeenCalledWith(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCORX3Cl7ByidjEgzSCgv9Yw',
      expect.objectContaining({ since: undefined })
    );
    expect(mockBuildYouTubeFeedFromUrl).not.toHaveBeenCalled();
  });

  it('falls through to normal discovery for non-YouTube URLs', async () => {
    const url = 'https://example.com';
    mockIsYouTubeUrl.mockReturnValueOnce(false);
    mockDiscoverRssFeed.mockResolvedValueOnce('https://example.com/rss.xml');
    mockFetchAndParseRss.mockResolvedValueOnce({
      title: 'Example Feed',
      items: [],
    });

    const res = await request(app)
      .post('/api/rss/fetch')
      .set('X-API-Key', API_KEY)
      .send({ url })
      .expect(200);

    expect(res.body.feedUrl).toBe('https://example.com/rss.xml');
    expect(mockDiscoverRssFeed).toHaveBeenCalledWith(url);
  });

  it('returns controlled error when YouTube API feed generation fails', async () => {
    const url = 'https://www.youtube.com/channel/UCORX3Cl7ByidjEgzSCgv9Yw';
    mockIsYouTubeUrl.mockReturnValueOnce(true);
    const err = new Error('YOUTUBE_API_KEY is required for YouTube feed fetches');
    err.statusCode = 424;
    err.code = 'MISSING_YOUTUBE_API_KEY';
    mockBuildYouTubeFeedFromUrl.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/rss/fetch')
      .set('X-API-Key', API_KEY)
      .send({ url })
      .expect(424);

    expect(res.body).toMatchObject({
      error: 'YOUTUBE_API_KEY is required for YouTube feed fetches',
      code: 'MISSING_YOUTUBE_API_KEY',
    });
  });

  it('falls back to YouTube API when direct YouTube RSS fetch fails', async () => {
    const url = 'https://www.youtube.com/channel/UCORX3Cl7ByidjEgzSCgv9Yw';
    mockIsYouTubeUrl.mockReturnValueOnce(true);
    mockDiscoverRssFeed.mockResolvedValueOnce('https://www.youtube.com/feeds/videos.xml?channel_id=UCORX3Cl7ByidjEgzSCgv9Yw');
    mockFetchAndParseRss.mockRejectedValueOnce(new Error('Direct RSS timeout'));
    mockBuildYouTubeFeedFromUrl.mockResolvedValueOnce({
      feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCORX3Cl7ByidjEgzSCgv9Yw',
      feed: {
        title: 'API Feed',
        items: [{ title: 'API Video A', link: 'https://www.youtube.com/watch?v=FQhoQ4bRbe8' }],
      },
    });

    const res = await request(app)
      .post('/api/rss/fetch')
      .set('X-API-Key', API_KEY)
      .send({ url })
      .expect(200);

    expect(res.body.feed.title).toBe('API Feed');
    expect(mockBuildYouTubeFeedFromUrl).toHaveBeenCalledWith(url, expect.objectContaining({ since: undefined }));
  });
});

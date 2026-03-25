import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockAxiosGet = jest.fn();
const mockAxiosHead = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
    head: mockAxiosHead
  }
}));

const { discoverRssFeed } = await import('../../src/services/rssDiscovery.js');

describe('RSS Discovery Service', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockAxiosHead.mockReset();
  });

  it('returns input URL when it is already a feed', async () => {
    const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnYMOamNKLGVlJgRUbamveA';
    mockAxiosHead.mockResolvedValueOnce({
      headers: { 'content-type': 'application/atom+xml' }
    });

    const discovered = await discoverRssFeed(feedUrl);

    expect(discovered).toBe(feedUrl);
    expect(mockAxiosHead).toHaveBeenCalledTimes(1);
    expect(mockAxiosHead).toHaveBeenCalledWith(
      feedUrl,
      expect.objectContaining({
        timeout: expect.any(Number)
      })
    );
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('continues normal discovery for non-feed pages', async () => {
    const pageUrl = 'https://example.com/blog';
    mockAxiosHead.mockResolvedValueOnce({
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
    mockAxiosGet.mockResolvedValueOnce({
      data: `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
          </head>
          <body></body>
        </html>
      `
    });

    const discovered = await discoverRssFeed(pageUrl);

    expect(discovered).toBe('https://example.com/feed.xml');
    expect(mockAxiosHead).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      pageUrl,
      expect.objectContaining({
        timeout: expect.any(Number)
      })
    );
  });
});

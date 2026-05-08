import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockAxiosGet = jest.fn();
const originalYoutubeApiKey = process.env.YOUTUBE_API_KEY;

jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
}));

const {
  buildYouTubeFeedFromUrl,
  isYouTubeUrl,
  YouTubeFeedError,
} = await import('../../src/services/youtubeFeedService.js');

describe('youtubeFeedService', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    process.env.YOUTUBE_API_KEY = 'yt-api-key';
  });

  afterEach(() => {
    if (originalYoutubeApiKey === undefined) {
      delete process.env.YOUTUBE_API_KEY;
      return;
    }
    process.env.YOUTUBE_API_KEY = originalYoutubeApiKey;
  });

  it('detects YouTube URLs', () => {
    expect(isYouTubeUrl('https://www.youtube.com/channel/UC123')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true);
    expect(isYouTubeUrl('https://example.com/feed.xml')).toBe(false);
  });

  it('builds a feed from a /channel URL and omits legacy XML-only fields', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'UCORX3Cl7ByidjEgzSCgv9Yw',
              snippet: {
                title: 'Anastasi In Tech',
                description: 'Tech channel',
              },
              contentDetails: {
                relatedPlaylists: {
                  uploads: 'UUORX3Cl7ByidjEgzSCgv9Yw',
                },
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              snippet: {
                title: 'New American Chip Factory That Terrifies TSMC',
                description: 'Long-form description from API',
                resourceId: { videoId: 'FQhoQ4bRbe8' },
                thumbnails: {
                  high: { url: 'https://i3.ytimg.com/vi/FQhoQ4bRbe8/hqdefault.jpg' },
                },
                videoOwnerChannelTitle: 'Anastasi In Tech',
              },
              contentDetails: {
                videoPublishedAt: '2026-04-15T22:40:12Z',
              },
            },
          ],
        },
      });

    const result = await buildYouTubeFeedFromUrl(
      'https://www.youtube.com/channel/UCORX3Cl7ByidjEgzSCgv9Yw'
    );

    expect(result.feedUrl).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCORX3Cl7ByidjEgzSCgv9Yw'
    );
    expect(result.feed.title).toBe('Anastasi In Tech');
    expect(result.feed.items).toHaveLength(1);
    expect(result.feed.items[0]).toMatchObject({
      title: 'New American Chip Factory That Terrifies TSMC',
      link: 'https://www.youtube.com/watch?v=FQhoQ4bRbe8',
      pubDate: '2026-04-15T22:40:12Z',
      creator: 'Anastasi In Tech',
      content: 'Long-form description from API',
      guid: 'yt:video:FQhoQ4bRbe8',
      thumbnail: 'https://i3.ytimg.com/vi/FQhoQ4bRbe8/hqdefault.jpg',
    });

    expect(result.feed.items[0]).not.toHaveProperty('updated');
    expect(result.feed.items[0]).not.toHaveProperty('media:starRating');
    expect(result.feed.items[0]).not.toHaveProperty('media:content');
  });

  it('resolves channel from @handle URL', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'UC_HANDLE_CHANNEL',
              snippet: { title: 'Handle Channel', description: '' },
              contentDetails: { relatedPlaylists: { uploads: 'UU_HANDLE_CHANNEL' } },
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { items: [] } });

    const result = await buildYouTubeFeedFromUrl('https://www.youtube.com/@HandleChannel');
    expect(result.channelId).toBe('UC_HANDLE_CHANNEL');
    expect(result.feed.items).toEqual([]);
  });

  it('throws a controlled error when API key is missing', async () => {
    delete process.env.YOUTUBE_API_KEY;

    await expect(
      buildYouTubeFeedFromUrl('https://www.youtube.com/channel/UCORX3Cl7ByidjEgzSCgv9Yw')
    ).rejects.toMatchObject({
      code: 'MISSING_YOUTUBE_API_KEY',
      statusCode: 424,
    });
  });

  it('resolves watch URLs through videos.list channel lookup', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              snippet: {
                channelId: 'UC_VIDEO_OWNER',
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'UC_VIDEO_OWNER',
              snippet: { title: 'Video Owner', description: '' },
              contentDetails: { relatedPlaylists: { uploads: 'UU_VIDEO_OWNER' } },
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { items: [] } });

    const result = await buildYouTubeFeedFromUrl('https://www.youtube.com/watch?v=FQhoQ4bRbe8');
    expect(result.channelId).toBe('UC_VIDEO_OWNER');
  });

  it('raises not found when channel cannot be resolved', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { items: [] } });

    await expect(
      buildYouTubeFeedFromUrl('https://www.youtube.com/channel/UCUNKNOWN')
    ).rejects.toBeInstanceOf(YouTubeFeedError);
  });
});

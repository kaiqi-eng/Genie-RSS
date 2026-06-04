import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';

const API_KEY = process.env.API_KEY || 'test-api-key-12345';
const originalYoutubeApiKey = process.env.YOUTUBE_API_KEY;

const mockAxiosGet = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet,
  },
}));

const { default: app } = await import('../../src/index.js');

describe('YouTube Routes', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
  });

  afterEach(() => {
    if (originalYoutubeApiKey === undefined) {
      delete process.env.YOUTUBE_API_KEY;
      return;
    }
    process.env.YOUTUBE_API_KEY = originalYoutubeApiKey;
  });

  describe('POST /api/youtube/resolve-channels', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/youtube/resolve-channels')
        .send({ channelNames: ['Fireship'] })
        .expect(401);
    });

    it('should require channelNames in request body', async () => {
      const res = await request(app)
        .post('/api/youtube/resolve-channels')
        .set('X-API-Key', API_KEY)
        .send({})
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
      expect(res.body.details[0].field).toBe('channelNames');
    });

    it('should return structured result for valid channel name', async () => {
      process.env.YOUTUBE_API_KEY = 'yt-api-key';
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: { channelId: 'UCsBjURrPoezykLs9EqgamOA' },
              snippet: { title: 'Fireship' },
            },
          ],
        },
      });

      const res = await request(app)
        .post('/api/youtube/resolve-channels')
        .set('X-API-Key', API_KEY)
        .send({ channelNames: ['Fireship'] })
        .expect(200);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0]).toEqual({
        inputName: 'Fireship',
        found: true,
        channelId: 'UCsBjURrPoezykLs9EqgamOA',
        channelUrl: 'https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA',
        rssUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA',
        matchedTitle: 'Fireship',
        source: 'youtube_api',
      });
    });

    it('should use web fallback when YouTube API key is missing', async () => {
      delete process.env.YOUTUBE_API_KEY;
      mockAxiosGet.mockResolvedValueOnce({
        data: '{"channelRenderer":{"channelId":"UCXuqSBlHAE6Xw-yeJA0Tunw","title":{"simpleText":"Linus Tech Tips"}}}',
      });

      const res = await request(app)
        .post('/api/youtube/resolve-channels')
        .set('X-API-Key', API_KEY)
        .send({ channelNames: ['Linus Tech Tips'] })
        .expect(200);

      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0]).toMatchObject({
        inputName: 'Linus Tech Tips',
        found: true,
        source: 'web_fallback',
        channelId: 'UCXuqSBlHAE6Xw-yeJA0Tunw',
        matchedTitle: 'Linus Tech Tips',
      });
    });

    it('should handle partial failures across multiple names', async () => {
      process.env.YOUTUBE_API_KEY = 'yt-api-key';
      mockAxiosGet
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: { channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
                snippet: { title: 'Google for Developers' },
              },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { items: [] } })
        .mockResolvedValueOnce({ data: '<html><body>No channel match</body></html>' });

      const res = await request(app)
        .post('/api/youtube/resolve-channels')
        .set('X-API-Key', API_KEY)
        .send({ channelNames: ['Google for Developers', 'Unknown Name'] })
        .expect(200);

      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0]).toMatchObject({
        inputName: 'Google for Developers',
        found: true,
        source: 'youtube_api',
        channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      });
      expect(res.body.results[1]).toMatchObject({
        inputName: 'Unknown Name',
        found: false,
        source: 'none',
        channelId: null,
      });
    });
  });
});

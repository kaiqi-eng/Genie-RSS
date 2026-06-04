import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/services/linkedinService.js', () => ({
  fetchProfilePosts: jest.fn(),
  fetchTopicPosts: jest.fn(),
}));

const linkedinService = await import('../../src/services/linkedinService.js');
const { default: app } = await import('../../src/index.js');
const request = (await import('supertest')).default;

const VALID_API_KEY = process.env.API_KEY || 'test-key';

const mockProfileResult = {
  source: 'profile',
  profileUrl: 'https://www.linkedin.com/in/satyanadella/',
  name: 'Satya Nadella',
  headline: 'Chairman and CEO at Microsoft',
  posts: [
    {
      text: 'Excited about the future of AI...',
      author: 'Satya Nadella',
      pubDate: '2024-06-01T10:00:00.000Z',
      reactions: 4200,
      postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:123/',
      imageUrl: null,
    },
  ],
  fetchedAt: '2024-06-04T12:00:00.000Z',
};

const mockTopicResult = {
  source: 'topic',
  topic: 'artificial intelligence',
  searchUrl: 'https://www.linkedin.com/search/results/content/?keywords=artificial+intelligence&sortBy=date_posted',
  posts: [
    {
      text: 'AI is transforming the industry...',
      author: 'Jane Doe',
      pubDate: '2024-06-04T09:00:00.000Z',
      reactions: 150,
      postUrl: null,
      imageUrl: null,
    },
  ],
  fetchedAt: '2024-06-04T12:00:00.000Z',
};

describe('POST /api/linkedin/profile-posts', () => {
  beforeEach(() => {
    linkedinService.fetchProfilePosts.mockResolvedValue(mockProfileResult);
  });

  it('returns 200 with posts for a valid LinkedIn profile URL', async () => {
    const res = await request(app)
      .post('/api/linkedin/profile-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ profileUrl: 'https://www.linkedin.com/in/satyanadella/' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.posts).toHaveLength(1);
    expect(linkedinService.fetchProfilePosts).toHaveBeenCalledWith(
      'https://www.linkedin.com/in/satyanadella/',
      10
    );
  });

  it('respects the maxPosts parameter', async () => {
    await request(app)
      .post('/api/linkedin/profile-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ profileUrl: 'https://www.linkedin.com/in/satyanadella/', maxPosts: 5 });

    expect(linkedinService.fetchProfilePosts).toHaveBeenCalledWith(
      expect.any(String),
      5
    );
  });

  it('returns 400 for a non-LinkedIn URL', async () => {
    const res = await request(app)
      .post('/api/linkedin/profile-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ profileUrl: 'https://twitter.com/satyanadella' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a missing profileUrl', async () => {
    const res = await request(app)
      .post('/api/linkedin/profile-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 500 when the service throws', async () => {
    linkedinService.fetchProfilePosts.mockRejectedValue(new Error('ScrapingBee error'));

    const res = await request(app)
      .post('/api/linkedin/profile-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ profileUrl: 'https://www.linkedin.com/in/satyanadella/' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/linkedin/topic-posts', () => {
  beforeEach(() => {
    linkedinService.fetchTopicPosts.mockResolvedValue(mockTopicResult);
  });

  it('returns 200 with posts for a valid topic', async () => {
    const res = await request(app)
      .post('/api/linkedin/topic-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ topic: 'artificial intelligence' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.posts).toHaveLength(1);
    expect(linkedinService.fetchTopicPosts).toHaveBeenCalledWith('artificial intelligence', 10);
  });

  it('returns 400 for a topic that is too short', async () => {
    const res = await request(app)
      .post('/api/linkedin/topic-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ topic: 'a' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a missing topic', async () => {
    const res = await request(app)
      .post('/api/linkedin/topic-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 500 when the service throws', async () => {
    linkedinService.fetchTopicPosts.mockRejectedValue(new Error('Network error'));

    const res = await request(app)
      .post('/api/linkedin/topic-posts')
      .set('x-api-key', VALID_API_KEY)
      .send({ topic: 'finance' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

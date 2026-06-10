import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock linkedin service
jest.unstable_mockModule('../../src/services/linkedinService.js', () => ({
  fetchProfilePosts: jest.fn(),
  fetchTopicPosts: jest.fn(),
}));

const linkedinService = await import(
  '../../src/services/linkedinService.js'
);

const { default: app } = await import('../../src/index.js');
const request = (await import('supertest')).default;

describe('LinkedIn endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/linkedin/profile-posts', () => {
    const mockProfilePosts = [
      {
        title: 'Satya Nadella - LinkedIn Post',
        content: 'Excited about the future of AI...',
        source_type: 'linkedin',
        content_type: 'post',
        source_id: '123',
        source_url:
          'https://www.linkedin.com/feed/update/urn:li:activity:123/',
        builder_id: 'linkedin-service',
        project_tags: ['linkedin'],
        metadata: {
          author: 'Satya Nadella',
          pubDate: '2024-06-01T10:00:00.000Z',
          reactions: 4200,
          imageUrl: null,
        },
      },
    ];

    it('should return 200 with posts for a valid LinkedIn profile URL', async () => {
      linkedinService.fetchProfilePosts.mockResolvedValue(
        mockProfilePosts
      );

      const res = await request(app)
        .post('/api/linkedin/profile-posts')
        .send({
          profileUrl: 'https://www.linkedin.com/in/satyanadella/',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      expect(
        linkedinService.fetchProfilePosts
      ).toHaveBeenCalledWith(
        'https://www.linkedin.com/in/satyanadella/',
        10
      );
    });

    it('should respect maxPosts parameter', async () => {
      linkedinService.fetchProfilePosts.mockResolvedValue(
        mockProfilePosts
      );

      await request(app)
        .post('/api/linkedin/profile-posts')
        .send({
          profileUrl: 'https://www.linkedin.com/in/satyanadella/',
          maxPosts: 5,
        });

      expect(
        linkedinService.fetchProfilePosts
      ).toHaveBeenCalledWith(
        'https://www.linkedin.com/in/satyanadella/',
        5
      );
    });

    it('should return 400 for invalid LinkedIn URL', async () => {
      const res = await request(app)
        .post('/api/linkedin/profile-posts')
        .send({
          profileUrl: 'https://twitter.com/satyanadella',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when profileUrl is missing', async () => {
      const res = await request(app)
        .post('/api/linkedin/profile-posts')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 500 when service throws an error', async () => {
      linkedinService.fetchProfilePosts.mockRejectedValue(
        new Error('Apify error')
      );

      const res = await request(app)
        .post('/api/linkedin/profile-posts')
        .send({
          profileUrl: 'https://www.linkedin.com/in/satyanadella/',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Apify error');
    });
  });

  describe('POST /api/linkedin/topic-posts', () => {
    const payload = {
      searchQueries: ['artificial intelligence'],
      contentType: 'posts',
      maxPosts: 5,
    };

    const mockTopicPosts = [
      {
        title: 'Jane Doe - LinkedIn Post',
        content: 'AI is transforming the industry...',
        source_type: 'linkedin',
        content_type: 'post',
        source_id: '456',
        source_url:
          'https://www.linkedin.com/feed/update/urn:li:activity:456/',
        builder_id: 'linkedin-service',
        project_tags: ['linkedin'],
        metadata: {
          author: 'Jane Doe',
          pubDate: '2024-06-04T09:00:00.000Z',
          reactions: 150,
          imageUrl: null,
          source: 'topic',
          searchQueries: ['artificial intelligence'],
        },
      },
    ];

    it('should return 200 with posts for valid search queries', async () => {
      linkedinService.fetchTopicPosts.mockResolvedValue(
        mockTopicPosts
      );

      const res = await request(app)
        .post('/api/linkedin/topic-posts')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      // Match actual endpoint payload with defaults
      expect(
        linkedinService.fetchTopicPosts
      ).toHaveBeenCalledWith({
        searchQueries: ['artificial intelligence'],
        contentType: 'posts',
        maxPosts: 5,
        maxReactions: 5,
        scrapeComments: false,
        scrapeReactions: false,
        postNestedComments: false,
        postNestedReactions: false,
      });
    });

    it('should return 400 when searchQueries is missing', async () => {
      const res = await request(app)
        .post('/api/linkedin/topic-posts')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when searchQueries is empty', async () => {
      const res = await request(app)
        .post('/api/linkedin/topic-posts')
        .send({
          searchQueries: [],
        });

      expect(res.status).toBe(400);
    });

    it('should return 500 when service throws an error', async () => {
      linkedinService.fetchTopicPosts.mockRejectedValue(
        new Error('Network error')
      );

      const res = await request(app)
        .post('/api/linkedin/topic-posts')
        .send(payload);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Network error');
    });
  });
});

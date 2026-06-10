import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn(),
  },
}));

const axios = (await import('axios')).default;
const { fetchProfilePosts, fetchTopicPosts } = await import('../../src/services/linkedinService.js');

const mockProfileData = [
  {
    urn: { activity_urn: '123' },
    posted_at: { timestamp: 1761328564096 },
    text: 'So many updates this month.',
    url: 'https://www.linkedin.com/posts/satyanadella_so-many-updates-activity-123',
    author: {
      first_name: 'Satya',
      last_name: 'Nadella',
      headline: 'Chairman and CEO at Microsoft'
    },
    stats: { total_reactions: 9531 },
    media: { url: 'https://media.com/video.mp4' }
  }
];

const mockTopicData = [
  {
    type: 'post',
    id: '7468299189119156224',
    linkedinUrl: 'https://www.linkedin.com/posts/pchernin_ai-intelligence-activity-7468299189119156224',
    content: 'AI is no longer just a tool.',
    author: {
      name: 'Paul Chernin'
    },
    postedAt: {
      timestamp: 1780581280975
    },
    engagement: {
      likes: 4
    },
    article: {
      image: {
        url: 'https://media.com/image.jpg'
      }
    }
  }
];

describe('LinkedIn Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProfilePosts', () => {
    it('successfully fetches and maps profile posts', async () => {
      axios.post.mockResolvedValue({ data: mockProfileData });

      const result = await fetchProfilePosts('https://www.linkedin.com/in/satyanadella', 5);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('apimaestro~linkedin-profile-posts/run-sync-get-dataset-items'),
        {
          urls: ['https://www.linkedin.com/in/satyanadella'],
          maxPosts: 5,
        },
        expect.any(Object)
      );

      expect(result).toEqual([
        {
          title: 'Satya Nadella - LinkedIn Post',
          content: 'So many updates this month.',
          source_type: 'linkedin',
          content_type: 'post',
          source_id: 'satyanadella_so-many-updates-activity-123',
          source_url: 'https://www.linkedin.com/posts/satyanadella_so-many-updates-activity-123',
          builder_id: 'linkedin-service',
          project_tags: ['linkedin'],
          metadata: {
            author: 'Satya Nadella',
            pubDate: '2025-10-24T17:56:04.096Z',
            reactions: 9531,
            imageUrl: 'https://media.com/video.mp4',
            profileUrl: 'https://www.linkedin.com/in/satyanadella',
            source: 'profile',
            headline: 'Chairman and CEO at Microsoft',
          },
        }
      ]);
    });

    it('handles empty results from Apify', async () => {
      axios.post.mockResolvedValue({ data: [] });

      const result = await fetchProfilePosts('https://www.linkedin.com/in/satyanadella', 5);

      expect(result).toEqual([]);
    });

    it('throws error on invalid response format', async () => {
      axios.post.mockResolvedValue({ data: {} });

      await expect(fetchProfilePosts('https://www.linkedin.com/in/satyanadella', 5))
        .rejects.toThrow('Invalid response format from Apify LinkedIn profile posts scraper');
    });
  });

  describe('fetchTopicPosts', () => {
    it('successfully fetches and maps topic posts', async () => {
      axios.post.mockResolvedValue({ data: mockTopicData });

      const result = await fetchTopicPosts({
        searchQueries: ['artificial intelligence'],
        maxPosts: 5,
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('harvestapi~linkedin-post-search/run-sync-get-dataset-items'),
        expect.objectContaining({
          searchQueries: ['artificial intelligence'],
          maxPosts: 5,
        }),
        expect.any(Object)
      );

      expect(result).toEqual([
        {
          title: 'Paul Chernin - LinkedIn Post',
          content: 'AI is no longer just a tool.',
          source_type: 'linkedin',
          content_type: 'post',
          source_id: 'pchernin_ai-intelligence-activity-7468299189119156224',
          source_url: 'https://www.linkedin.com/posts/pchernin_ai-intelligence-activity-7468299189119156224',
          builder_id: 'linkedin-service',
          project_tags: ['linkedin'],
          metadata: {
            author: 'Paul Chernin',
            pubDate: '2026-06-04T13:54:40.975Z',
            reactions: 4,
            imageUrl: 'https://media.com/image.jpg',
            source: 'topic',
            searchQueries: ['artificial intelligence'],
            searchUrl: 'https://www.linkedin.com/search/results/content/?keywords=artificial%20intelligence&sortBy=date_posted',
          },
        }
      ]);
    });

    it('throws error on invalid response format', async () => {
      axios.post.mockResolvedValue({ data: null });

      await expect(fetchTopicPosts({
        searchQueries: ['artificial intelligence'],
        maxPosts: 5,
      }))
        .rejects.toThrow('Invalid response format from Apify post search scraper');
    });
  });
});

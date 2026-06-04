import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { credentials, timeouts, limits } from '../config/index.js';

const logger = createLogger('services:linkedin');

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Fetch latest posts from a LinkedIn profile URL using Apify.
 * @param {string} profileUrl - e.g. https://www.linkedin.com/in/username/
 * @param {number} [maxPosts=10]
 * @returns {Promise<object>}
 */
export async function fetchProfilePosts(profileUrl, maxPosts = 10) {
  logger.info('Fetching LinkedIn profile posts via Apify', { profileUrl, maxPosts });

  try {
    const response = await axios.post(
      `https://api.apify.com/v2/actors/apimaestro~linkedin-profile-posts/run-sync-get-dataset-items?token=${credentials.apifyToken}`,
      {
        urls: [profileUrl],
        maxPosts,
      },
      {
        timeout: timeouts.scrapingBee || 30000,
      }
    );

    const items = response.data;
    if (!Array.isArray(items)) {
      throw new Error('Invalid response format from Apify LinkedIn profile posts scraper');
    }

    const name = items.length > 0 && items[0].author
      ? `${items[0].author.first_name || ''} ${items[0].author.last_name || ''}`.trim() || null
      : null;

    const headline = items.length > 0 && items[0].author
      ? items[0].author.headline || null
      : null;

    const posts = items.map(item => {
      const postAuthor = item.author
        ? `${item.author.first_name || ''} ${item.author.last_name || ''}`.trim() || null
        : null;

      let pubDate = null;
      if (item.posted_at?.timestamp) {
        pubDate = new Date(item.posted_at.timestamp).toISOString();
      } else if (item.posted_at?.date) {
        pubDate = new Date(item.posted_at.date).toISOString();
      }

      return {
        text: (item.text || '').substring(0, limits.maxContentLength * 2),
        author: postAuthor,
        pubDate,
        reactions: item.stats?.total_reactions || null,
        postUrl: item.url || null,
        imageUrl: item.media?.url || item.media?.thumbnail || null,
      };
    });

    logger.info('LinkedIn profile posts fetched successfully', { profileUrl, postCount: posts.length });

    return {
      source: 'profile',
      profileUrl,
      name,
      headline,
      posts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error fetching LinkedIn profile posts via Apify', { profileUrl, error });
    throw error;
  }
}

/**
 * Fetch latest posts for a given topic/keyword from LinkedIn using Apify.
 * @param {string} topic - e.g. "artificial intelligence"
 * @param {number} [maxPosts=10]
 * @returns {Promise<object>}
 */
export async function fetchTopicPosts(topic, maxPosts = 10) {
  logger.info('Fetching LinkedIn topic posts via Apify', { topic, maxPosts });

  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(topic)}&sortBy=date_posted`;

  try {
    const response = await axios.post(
      `https://api.apify.com/v2/actors/harvestapi~linkedin-post-search/run-sync-get-dataset-items?token=${credentials.apifyToken}`,
      {
        searchQueries: [topic],
        maxPosts,
      },
      {
        timeout: timeouts.scrapingBee || 30000,
      }
    );

    const items = response.data;
    if (!Array.isArray(items)) {
      throw new Error('Invalid response format from Apify LinkedIn post search scraper');
    }

    const posts = items.map(item => {
      const authorName = item.author?.name || null;

      let pubDate = null;
      if (item.postedAt?.timestamp) {
        pubDate = new Date(item.postedAt.timestamp).toISOString();
      } else if (item.postedAt?.date) {
        pubDate = new Date(item.postedAt.date).toISOString();
      }

      return {
        text: (item.content || '').substring(0, limits.maxContentLength * 2),
        author: authorName,
        pubDate,
        reactions: item.engagement?.likes || null,
        postUrl: item.linkedinUrl || item.shareLinkedinUrl || null,
        imageUrl: item.article?.image?.url || item.postImages?.[0]?.url || null,
      };
    });

    logger.info('LinkedIn topic posts fetched successfully', { topic, postCount: posts.length });

    return {
      source: 'topic',
      topic,
      searchUrl,
      posts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error fetching LinkedIn topic posts via Apify', { topic, error });
    throw error;
  }
}
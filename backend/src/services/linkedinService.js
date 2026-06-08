import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { credentials, timeouts, limits } from '../config/index.js';

const logger = createLogger('services:linkedin');

// ─────────────────────────────────────────────
// PROFILE POSTS
// ─────────────────────────────────────────────

/**
 * Fetch latest posts from a LinkedIn profile URL using Apify.
 * @param {string} profileUrl
 * @param {number} [maxPosts=10]
 */
export async function fetchProfilePosts(profileUrl, maxPosts = 10) {
  logger.info('Fetching LinkedIn profile posts via Apify', {
    profileUrl,
    maxPosts,
  });

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

    const name =
      items.length > 0 && items[0].author
        ? `${items[0].author.first_name || ''} ${items[0].author.last_name || ''}`.trim() || null
        : null;

    const headline =
      items.length > 0 && items[0].author
        ? items[0].author.headline || null
        : null;

    const posts = items.map((item) => {
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

    logger.info('LinkedIn profile posts fetched successfully', {
      profileUrl,
      postCount: posts.length,
    });

    return {
      source: 'profile',
      profileUrl,
      name,
      headline,
      posts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error fetching LinkedIn profile posts via Apify', {
      profileUrl,
      error,
    });
    throw error;
  }
}

// ─────────────────────────────────────────────
// TOPIC POSTS (UPDATED)
// ─────────────────────────────────────────────

/**
 * Fetch LinkedIn posts using advanced topic search payload.
 * @param {object} payload
 */
export async function fetchTopicPosts(payload) {
  const {
    authorUrls,
    authorsCompanies,
    contentType = 'all',
    maxPosts = 20,
    maxReactions = 5,
    postNestedComments = false,
    postNestedReactions = false,
    scrapeComments = false,
    scrapeReactions = false,
    searchQueries,
  } = payload;

  logger.info('Fetching LinkedIn topic posts via Apify', {
    searchQueries,
    maxPosts,
  });

  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
    searchQueries.join(' ')
  )}&sortBy=date_posted`;

  try {
    const response = await axios.post(
      `https://api.apify.com/v2/actors/harvestapi~linkedin-post-search/run-sync-get-dataset-items?token=${credentials.apifyToken}`,
      {
        searchQueries,

        ...(authorUrls?.length ? { authorUrls } : {}),
        ...(authorsCompanies?.length ? { authorsCompanies } : {}),

        contentType,
        maxPosts,
        maxReactions,
        postNestedComments,
        postNestedReactions,
        scrapeComments,
        scrapeReactions,
      },
      {
        timeout: timeouts.scrapingBee || 30000,
      }
    );

    const items = response.data;

    if (!Array.isArray(items)) {
      throw new Error('Invalid response format from Apify post search scraper');
    }

    const posts = items.map((item) => {
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

    logger.info('LinkedIn topic posts fetched successfully', {
      searchQueries,
      postCount: posts.length,
    });

    return {
      source: 'topic',
      searchQueries,
      searchUrl,
      posts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error fetching LinkedIn topic posts via Apify', {
      searchQueries,
      error,
    });
    throw error;
  }
}

import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { credentials, timeouts, limits } from '../config/index.js';

const logger = createLogger('services:linkedin');

const DEFAULT_BUILDER_ID = 'linkedin-service';
const DEFAULT_PROJECT_TAGS = ['linkedin'];
const SOURCE_TYPE = 'linkedin';
const CONTENT_TYPE = 'post';

/**
 * Convert LinkedIn post → required schema
 */
function mapToSchema(post, extraMetadata = {}) {
  return {
    title:
      post.author && post.pubDate
        ? `${post.author} - LinkedIn Post`
        : 'LinkedIn Post',

    content: (post.text || '').substring(
      0,
      limits.maxContentLength * 2
    ),

    source_type: SOURCE_TYPE,
    content_type: CONTENT_TYPE,

    source_id:
      post.postUrl?.split('/').filter(Boolean).pop() ||
      crypto.randomUUID(),

    source_url: post.postUrl || '',

    builder_id: DEFAULT_BUILDER_ID,

    project_tags: DEFAULT_PROJECT_TAGS,

    metadata: {
      author: post.author || null,
      pubDate: post.pubDate || null,
      reactions: post.reactions || 0,
      imageUrl: post.imageUrl || null,
      ...extraMetadata,
    },
  };
}

// ─────────────────────────────────────────────
// PROFILE POSTS
// ─────────────────────────────────────────────

function normalizeMaxPosts(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export async function fetchProfilePosts(
  profileUrl,
  maxPosts = 10
) {
  const postLimit = normalizeMaxPosts(maxPosts, 10);

  logger.info(
    'Fetching LinkedIn profile posts via Apify',
    {
      profileUrl,
      maxPosts: postLimit,
    }
  );

  try {
    // apimaestro/linkedin-profile-posts expects `limit` / `total_posts`,
    // not `maxPosts`. Keep `urls` for compatibility with current actor runs.
    const response = await axios.post(
      `https://api.apify.com/v2/actors/apimaestro~linkedin-profile-posts/run-sync-get-dataset-items?token=${credentials.apifyToken}`,
      {
        urls: [profileUrl],
        username: profileUrl,
        page_number: 1,
        limit: Math.min(postLimit, 100),
        total_posts: postLimit,
      },
      {
        timeout: timeouts.scrapingBee || 30000,
      }
    );

    const items = response.data;

    if (!Array.isArray(items)) {
      throw new Error(
        'Invalid response format from Apify LinkedIn profile posts scraper'
      );
    }

    const results = items
      .slice(0, postLimit)
      .map((item) => {
      const author = item.author
        ? `${item.author.first_name || ''} ${
            item.author.last_name || ''
          }`.trim()
        : null;

      let pubDate = null;

      if (item.posted_at?.timestamp) {
        pubDate = new Date(
          item.posted_at.timestamp
        ).toISOString();
      } else if (item.posted_at?.date) {
        pubDate = new Date(
          item.posted_at.date
        ).toISOString();
      }

      const post = {
        text: item.text || '',
        author,
        pubDate,
        reactions:
          item.stats?.total_reactions || 0,
        postUrl: item.url || '',
        imageUrl:
          item.media?.url ||
          item.media?.thumbnail ||
          null,
      };

      return mapToSchema(post, {
        profileUrl,
        source: 'profile',
        headline:
          item.author?.headline || null,
      });
    });

    logger.info(
      'LinkedIn profile posts fetched successfully',
      {
        profileUrl,
        postCount: results.length,
        requestedMaxPosts: postLimit,
        rawItemCount: items.length,
      }
    );

    return results;
  } catch (error) {
    logger.error(
      'Error fetching LinkedIn profile posts via Apify',
      {
        profileUrl,
        error,
      }
    );

    throw error;
  }
}

// ─────────────────────────────────────────────
// TOPIC POSTS
// ─────────────────────────────────────────────

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

  const postLimit = normalizeMaxPosts(maxPosts, 20);

  logger.info(
    'Fetching LinkedIn topic posts via Apify',
    {
      searchQueries,
      maxPosts: postLimit,
    }
  );

  const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
    searchQueries.join(' ')
  )}&sortBy=date_posted`;

  try {
    const response = await axios.post(
      `https://api.apify.com/v2/actors/harvestapi~linkedin-post-search/run-sync-get-dataset-items?token=${credentials.apifyToken}`,
      {
        searchQueries,

        ...(authorUrls?.length
          ? { authorUrls }
          : {}),

        ...(authorsCompanies?.length
          ? { authorsCompanies }
          : {}),

        contentType,
        maxPosts: postLimit,
        maxReactions,
        postNestedComments,
        postNestedReactions,
        scrapeComments,
        scrapeReactions,
      },
      {
        timeout:
          timeouts.scrapingBee || 30000,
      }
    );

    const items = response.data;

    if (!Array.isArray(items)) {
      throw new Error(
        'Invalid response format from Apify post search scraper'
      );
    }

    const results = items
      .slice(0, postLimit)
      .map((item) => {
      let pubDate = null;

      if (item.postedAt?.timestamp) {
        pubDate = new Date(
          item.postedAt.timestamp
        ).toISOString();
      } else if (item.postedAt?.date) {
        pubDate = new Date(
          item.postedAt.date
        ).toISOString();
      }

      const post = {
        text: item.content || '',
        author:
          item.author?.name || null,
        pubDate,
        reactions:
          item.engagement?.likes || 0,
        postUrl:
          item.linkedinUrl ||
          item.shareLinkedinUrl ||
          '',
        imageUrl:
          item.article?.image?.url ||
          item.postImages?.[0]?.url ||
          null,
      };

      return mapToSchema(post, {
        source: 'topic',
        searchQueries,
        searchUrl,
      });
    });

    logger.info(
      'LinkedIn topic posts fetched successfully',
      {
        searchQueries,
        postCount: results.length,
        requestedMaxPosts: postLimit,
        rawItemCount: items.length,
      }
    );

    return results;
  } catch (error) {
    logger.error(
      'Error fetching LinkedIn topic posts via Apify',
      {
        searchQueries,
        error,
      }
    );

    throw error;
  }
}

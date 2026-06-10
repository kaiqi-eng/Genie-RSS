import express from 'express';
import { fetchProfilePosts, fetchTopicPosts } from '../services/linkedinService.js';
import { validateLinkedInProfile, validateLinkedInTopic } from '../middleware/validator.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger('routes:linkedin');

/**
 * @swagger
 * /linkedin/profile-posts:
 *   post:
 *     summary: Get latest posts from a LinkedIn profile
 *     description: >
 *       Fetches the most recent posts from a public LinkedIn profile.
 *       Requires a valid APIFY ACTOR token to bypass
 *       LinkedIn's bot protection. Only public profile activity is accessible.
 *     tags: [LinkedIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileUrl
 *             properties:
 *               profileUrl:
 *                 type: string
 *                 format: uri
 *                 example: https://www.linkedin.com/in/satyanadella/
 *               maxPosts:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 10
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error
 */
router.post('/profile-posts', validateLinkedInProfile, async (req, res) => {
  const { profileUrl, maxPosts = 10 } = req.body;

  try {
    const data = await fetchProfilePosts(profileUrl, maxPosts);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Failed to fetch LinkedIn profile posts', {
      profileUrl,
      error,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch LinkedIn profile posts',
    });
  }
});

/**
 * @swagger
 * /linkedin/topic-posts:
 *   post:
 *     summary: Search LinkedIn posts using keywords, authors, and companies
 *     description: >
 *       Searches LinkedIn content using one or more search queries.
 *       Optional author URLs and company names can be provided to narrow results.
 *       Requires APIFY credentials.
 *     tags: [LinkedIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - searchQueries
 *             properties:
 *               authorUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 example:
 *                   - https://www.linkedin.com/in/satyanadella/
 *
 *               authorsCompanies:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - Microsoft
 *
 *               searchQueries:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 example:
 *                   - b2b sales
 *                   - revenue operations
 *
 *               contentType:
 *                 type: string
 *                 enum:
 *                   - all
 *                   - posts
 *                   - articles
 *                 default: all
 *
 *               maxPosts:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 20
 *
 *               maxReactions:
 *                 type: integer
 *                 minimum: 0
 *                 default: 5
 *
 *               postNestedComments:
 *                 type: boolean
 *                 default: false
 *
 *               postNestedReactions:
 *                 type: boolean
 *                 default: false
 *
 *               scrapeComments:
 *                 type: boolean
 *                 default: false
 *
 *               scrapeReactions:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error
 */
router.post('/topic-posts', validateLinkedInTopic, async (req, res) => {
  try {
    const data = await fetchTopicPosts(req.body);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Failed to fetch LinkedIn topic posts', {
      payload: req.body,
      error,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch LinkedIn topic posts',
    });
  }
});

export default router;

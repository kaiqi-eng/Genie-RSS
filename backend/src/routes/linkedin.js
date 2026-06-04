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
 *       Requires a valid ScrapingBee API key (`SCRAPINGBEE_API_KEY`) to bypass
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
 *                 description: Full LinkedIn profile URL
 *                 example: "https://www.linkedin.com/in/satyanadella/"
 *               maxPosts:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 10
 *                 description: Maximum number of posts to return
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     source:
 *                       type: string
 *                       example: profile
 *                     profileUrl:
 *                       type: string
 *                     name:
 *                       type: string
 *                     headline:
 *                       type: string
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LinkedInPost'
 *                     fetchedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error or ScrapingBee misconfiguration
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
    logger.error('Failed to fetch LinkedIn profile posts', { profileUrl, error });
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
 *     summary: Get latest LinkedIn posts for a topic or keyword
 *     description: >
 *       Searches LinkedIn for the most recent posts matching a given topic or keyword
 *       (e.g. "artificial intelligence", "finance", "startups").
 *       Uses LinkedIn's content search sorted by most recent.
 *       Requires `SCRAPINGBEE_API_KEY`.
 *     tags: [LinkedIn]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Topic or keyword to search for
 *                 example: "artificial intelligence"
 *               maxPosts:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 10
 *                 description: Maximum number of posts to return
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     source:
 *                       type: string
 *                       example: topic
 *                     topic:
 *                       type: string
 *                     searchUrl:
 *                       type: string
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LinkedInPost'
 *                     fetchedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error or ScrapingBee misconfiguration
 */
router.post('/topic-posts', validateLinkedInTopic, async (req, res) => {
  const { topic, maxPosts = 10 } = req.body;

  try {
    const data = await fetchTopicPosts(topic, maxPosts);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Failed to fetch LinkedIn topic posts', { topic, error });
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch LinkedIn topic posts',
    });
  }
});

export default router;

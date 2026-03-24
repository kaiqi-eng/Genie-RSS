import express from 'express';
import { validateYoutubeChannelLookup } from '../middleware/validator.js';
import { resolveChannels } from '../services/youtubeChannelResolver.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger('routes:youtube');

/**
 * @swagger
 * /youtube/resolve-channels:
 *   post:
 *     summary: Resolve YouTube channel names to channel and RSS links
 *     description: Finds the best matching YouTube channel for each provided name and returns the channel URL plus native YouTube RSS feed URL.
 *     tags: [YouTube]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channelNames
 *             properties:
 *               channelNames:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 25
 *                 items:
 *                   type: string
 *                 example: ["Fireship", "Google Developers"]
 *     responses:
 *       200:
 *         description: Channel resolution completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       inputName:
 *                         type: string
 *                       found:
 *                         type: boolean
 *                       channelId:
 *                         type: string
 *                         nullable: true
 *                       channelUrl:
 *                         type: string
 *                         nullable: true
 *                       rssUrl:
 *                         type: string
 *                         nullable: true
 *                       matchedTitle:
 *                         type: string
 *                         nullable: true
 *                       source:
 *                         type: string
 *                         enum: [youtube_api, web_fallback, none]
 *                       error:
 *                         type: string
 *                         nullable: true
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error
 */
router.post('/resolve-channels', validateYoutubeChannelLookup, async (req, res) => {
  try {
    const { channelNames } = req.body;
    const results = await resolveChannels(channelNames);
    return res.status(200).json({ results });
  } catch (error) {
    logger.error('Failed to resolve YouTube channels', { error });
    return res.status(500).json({
      error: 'Failed to resolve YouTube channels',
      details: error.message,
    });
  }
});

export default router;

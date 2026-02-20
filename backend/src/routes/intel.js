import express from 'express';
import axios from 'axios';
import { validateUrls } from '../utils/urlValidator.js';
import { createLogger } from '../utils/logger.js';
import { validateIntelUrls, validateDailyIntel } from '../middleware/validator.js';

const router = express.Router();
const logger = createLogger('routes:intel');

const WEBHOOK_URL = process.env.WEBHOOK_URL;

/**
 * Forward URLs to webhook endpoint in parallel
 * @param {string[]} urls - Array of URLs to forward
 * @param {string} endpoint - Webhook endpoint name (e.g., 'addintelurl', 'deleteintelurl')
 * @returns {Promise<Array>} - Array of results for each URL
 */
async function forwardToWebhook(urls, endpoint) {
    const startTime = Date.now();

    const results = await Promise.allSettled(
        urls.map(url =>
            axios.post(`${WEBHOOK_URL}/${endpoint}`, { url })
                .then(response => ({
                    url,
                    success: true,
                    data: response.data
                }))
                .catch(err => ({
                    url,
                    success: false,
                    error: err.response?.data || err.message
                }))
        )
    );

    const duration = Date.now() - startTime;
    logger.debug(`Forwarded ${urls.length} URLs to ${endpoint}`, { duration, urlCount: urls.length });

    // Extract values from Promise.allSettled results
    return results.map(result => result.value);
}

/**
 * Process intel URL request (shared logic for add/delete)
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} endpoint - Webhook endpoint
 * @param {string} action - Action description for logging
 */
async function processIntelUrls(req, res, endpoint, action) {
    try {
        // Zod validation ensures urls is a non-empty array
        const { urls } = req.body;

        // Validate all URLs for SSRF protection
        const { valid: validUrls, invalid: invalidUrls } = validateUrls(urls);

        // Build results array with invalid URLs first
        const invalidResults = invalidUrls.map(({ url, error }) => ({
            url,
            success: false,
            error: `URL validation failed: ${error}`
        }));

        // Forward valid URLs to webhook in parallel
        const validResults = validUrls.length > 0
            ? await forwardToWebhook(validUrls, endpoint)
            : [];

        const results = [...invalidResults, ...validResults];

        // Log summary
        const successCount = results.filter(r => r.success).length;
        logger.info(`${action} completed`, {
            total: urls.length,
            valid: validUrls.length,
            invalid: invalidUrls.length,
            successful: successCount
        });

        return res.json({
            success: true,
            results
        });

    } catch (error) {
        logger.error(`Failed to ${action.toLowerCase()}`, { error });
        return res.status(500).json({
            success: false,
            message: `Failed to ${action.toLowerCase()}`
        });
    }
}

// Add URL (parallel processing)
router.post('/addintelurl', validateIntelUrls, (req, res) =>
    processIntelUrls(req, res, 'addintelurl', 'Add intel URLs')
);

// Delete URL (parallel processing)
router.post('/deleteintelurl', validateIntelUrls, (req, res) =>
    processIntelUrls(req, res, 'deleteintelurl', 'Delete intel URLs')
);


// Get daily RSS feed
router.post('/getdailyintel', validateDailyIntel, async (req, res) => {
    try {
        // Zod validation ensures date is in YYYY-MM-DD format
        const { date } = req.body;

        const response = await axios.post(
            `${WEBHOOK_URL}/getdailyintel`,
            { params: { date } }
        );

        return res.json(response.data);

    } catch (error) {
        logger.error('Failed to get daily intel', {
            status: error.response?.status,
            data: error.response?.data,
            error
        });

        return res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});



export default router;

import express from 'express';
import axios from 'axios';
import { validateUrls } from '../utils/urlValidator.js';

const router = express.Router();

const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Add URL
router.post('/addintelurl', async (req, res) => {
    try {
        const { urls } = req.body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'URLs array is required'
            });
        }

        // Validate all URLs for SSRF protection
        const { valid: validUrls, invalid: invalidUrls } = validateUrls(urls);

        const results = [];

        // Add invalid URLs to results with error
        for (const { url, error } of invalidUrls) {
            results.push({
                url,
                success: false,
                error: `URL validation failed: ${error}`
            });
        }

        // Send one by one (strictly sequential) - only valid URLs
        for (let i = 0; i < validUrls.length; i++) {
            const url = validUrls[i];

            try {
                const response = await axios.post(
                    `${WEBHOOK_URL}/addintelurl`,
                    { url }
                );

                results.push({
                    url,
                    success: true,
                    data: response.data
                });

            } catch (err) {
                results.push({
                    url,
                    success: false,
                    error: err.response?.data || err.message
                });
            }
        }

        return res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to process URLs'
        });
    }
});


// Delete URL
router.post('/deleteintelurl', async (req, res) => {
    try {
        const { urls } = req.body; // expecting array

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'URLs array is required'
            });
        }

        // Validate all URLs for SSRF protection
        const { valid: validUrls, invalid: invalidUrls } = validateUrls(urls);

        const results = [];

        // Add invalid URLs to results with error
        for (const { url, error } of invalidUrls) {
            results.push({
                url,
                success: false,
                error: `URL validation failed: ${error}`
            });
        }

        // Process one by one (sequential) - only valid URLs
        for (let i = 0; i < validUrls.length; i++) {
            const url = validUrls[i];

            try {
                const response = await axios.post(
                    `${WEBHOOK_URL}/deleteintelurl`,
                    { url }
                );

                results.push({
                    url,
                    success: true,
                    data: response.data
                });

            } catch (err) {
                results.push({
                    url,
                    success: false,
                    error: err.response?.data || err.message
                });
            }
        }

        return res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete URLs'
        });
    }
});


// Get daily RSS feed
router.post('/getdailyintel', async (req, res) => {
    try {
        const { date } = req.body; // ✅ FIXED

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (!date || !dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Date is required in format YYYY-MM-DD'
            });
        }

        const response = await axios.post(
            `${WEBHOOK_URL}/getdailyintel`,
            { params: { date } }
        );

        return res.json(response.data);

    } catch (error) {
        console.error("STATUS:", error.response?.status);
        console.error("DATA:", error.response?.data);
        console.error("MESSAGE:", error.message);

        return res.status(500).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});



export default router;

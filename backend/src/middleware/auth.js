/**
 * API Key Authentication Middleware
 * Validates X-API-Key header against API_KEY environment variable
 */

export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  // Check if API_KEY is configured
  if (!validApiKey) {
    console.warn('WARNING: API_KEY not set in environment. API is unprotected!');
    return next();
  }

  // Validate the provided key
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  next();
};

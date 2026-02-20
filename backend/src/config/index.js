/**
 * Centralized configuration for Genie RSS Backend
 * All hardcoded values should be defined here for easy management
 */

// Helper to parse integer with fallback
const parseInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// Helper to parse boolean
const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  return value === 'true' || value === '1';
};

/**
 * Server configuration
 */
export const server = {
  port: parseInt(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV || 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV !== 'development',
  isTest: process.env.NODE_ENV === 'test'
};

/**
 * API Keys and credentials
 */
export const credentials = {
  apiKey: process.env.API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  scrapingBeeApiKey: process.env.SCRAPINGBEE_API_KEY,
  webhookUrl: process.env.WEBHOOK_URL,
  newsletter: {
    email: process.env.NEWSLETTER_EMAIL,
    password: process.env.NEWSLETTER_PASSWORD
  }
};

/**
 * HTTP request timeouts (in milliseconds)
 */
export const timeouts = {
  // RSS feed fetching
  rssFetch: parseInt(process.env.RSS_FETCH_TIMEOUT, 10000),

  // RSS discovery
  rssDiscovery: parseInt(process.env.RSS_DISCOVERY_TIMEOUT, 10000),
  rssDiscoveryFast: parseInt(process.env.RSS_DISCOVERY_FAST_TIMEOUT, 5000),

  // Web scraping
  scraper: parseInt(process.env.SCRAPER_TIMEOUT, 15000),

  // Feed processing
  feedProcess: parseInt(process.env.FEED_PROCESS_TIMEOUT, 15000),
  feedProcessLong: parseInt(process.env.FEED_PROCESS_LONG_TIMEOUT, 30000),

  // ScrapingBee
  scrapingBee: parseInt(process.env.SCRAPINGBEE_TIMEOUT, 30000)
};

/**
 * Request body size limits
 */
export const bodyLimits = {
  // Default JSON body limit
  json: process.env.BODY_LIMIT_JSON || '1mb',

  // Large payloads (transcripts)
  transcript: process.env.BODY_LIMIT_TRANSCRIPT || '10mb'
};

/**
 * RSS feed caching
 */
export const cache = {
  // Cache TTL in seconds (default: 1 hour)
  rssTtl: parseInt(process.env.RSS_CACHE_TTL, 3600),

  // Cache cleanup check period in seconds (default: 10 minutes)
  rssCheckPeriod: parseInt(process.env.RSS_CACHE_CHECK_PERIOD, 600)
};

/**
 * Rate limiting
 */
export const rateLimit = {
  // Max failed auth attempts before blocking
  maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS, 5),

  // Window in milliseconds (default: 15 minutes)
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000)
};

/**
 * Content limits
 */
export const limits = {
  // Maximum items to scrape from a page
  maxScrapedItems: parseInt(process.env.MAX_SCRAPED_ITEMS, 20),

  // Maximum content length for scraped items
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH, 500),

  // Maximum feeds to process in one request
  maxFeedsPerRequest: parseInt(process.env.MAX_FEEDS_PER_REQUEST, 50)
};

/**
 * Logging configuration
 */
export const logging = {
  level: process.env.LOG_LEVEL || (server.isDevelopment ? 'debug' : 'info')
};

/**
 * OpenAI/LLM configuration
 */
export const llm = {
  model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-0125',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0
};

// Default export with all config sections
const config = {
  server,
  credentials,
  timeouts,
  bodyLimits,
  cache,
  rateLimit,
  limits,
  logging,
  llm
};

export default config;

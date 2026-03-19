import dotenv from "dotenv";
dotenv.config();

// Helper to parse integer with fallback
const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// Helper to parse boolean
const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  return value === "true" || value === "1";
};

/**
 * Server configuration
 */
export const server = {
  port: parseInteger(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV || "production",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV !== "development",
  isTest: process.env.NODE_ENV === "test",
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
    password: process.env.NEWSLETTER_PASSWORD,
  },
  JWT_SECRET: process.env.JWT_SECRET,
};

console.log("JWT_SECRET from env:", process.env.JWT_SECRET ? "✅ loaded" : "❌ missing");

/**
 * HTTP request timeouts (in milliseconds)
 */
export const timeouts = {
  rssFetch: parseInteger(process.env.RSS_FETCH_TIMEOUT, 10000),
  rssDiscovery: parseInteger(process.env.RSS_DISCOVERY_TIMEOUT, 10000),
  rssDiscoveryFast: parseInteger(process.env.RSS_DISCOVERY_FAST_TIMEOUT, 5000),
  scraper: parseInteger(process.env.SCRAPER_TIMEOUT, 15000),
  feedProcess: parseInteger(process.env.FEED_PROCESS_TIMEOUT, 15000),
  feedProcessLong: parseInteger(process.env.FEED_PROCESS_LONG_TIMEOUT, 30000),
  scrapingBee: parseInteger(process.env.SCRAPINGBEE_TIMEOUT, 30000),
  llm: parseInteger(process.env.LLM_TIMEOUT, 60000),
};

/**
 * Request body size limits
 */
export const bodyLimits = {
  json: process.env.BODY_LIMIT_JSON || "1mb",
  transcript: process.env.BODY_LIMIT_TRANSCRIPT || "10mb",
};

/**
 * RSS feed caching
 */
export const cache = {
  rssTtl: parseInteger(process.env.RSS_CACHE_TTL, 3600),
  rssCheckPeriod: parseInteger(process.env.RSS_CACHE_CHECK_PERIOD, 600),
};

/**
 * Rate limiting
 */
export const rateLimit = {
  maxAttempts: parseInteger(process.env.RATE_LIMIT_MAX_ATTEMPTS, 5),
  windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
};

/**
 * Content limits
 */
export const limits = {
  maxScrapedItems: parseInteger(process.env.MAX_SCRAPED_ITEMS, 20),
  maxContentLength: parseInteger(process.env.MAX_CONTENT_LENGTH, 500),
  maxFeedsPerRequest: parseInteger(process.env.MAX_FEEDS_PER_REQUEST, 50),
};

/**
 * Logging configuration
 */
export const logging = {
  level: process.env.LOG_LEVEL || (server.isDevelopment ? "debug" : "info"),
};

/**
 * OpenAI/LLM configuration
 */
export const llm = {
  model: process.env.OPENAI_MODEL || "gpt-3.5-turbo-0125",
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0,
};

// Fail fast if JWT is required for this app
if (!credentials.JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET is not set in environment variables");
}

const config = {
  server,
  credentials,
  timeouts,
  bodyLimits,
  cache,
  rateLimit,
  limits,
  logging,
  llm,
};

export default config;
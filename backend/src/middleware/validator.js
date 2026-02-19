import { z } from 'zod';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('middleware:validator');

/**
 * Create validation middleware from a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      logger.debug('Validation failed', {
        path: req.path,
        errors
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace request data with parsed/transformed data
    req[source] = result.data;
    next();
  };
}

// ============================================
// Shared schemas
// ============================================

/**
 * URL string with basic format validation
 * Note: SSRF protection is handled separately by urlValidator.js
 */
const urlSchema = z.string().url({ message: 'Invalid URL format' });

/**
 * Array of URLs
 */
const urlArraySchema = z.array(urlSchema).min(1, 'At least one URL is required');

// ============================================
// Route-specific schemas
// ============================================

/**
 * POST /api/rss/fetch
 */
export const rssFetchSchema = z.object({
  url: urlSchema
});

/**
 * POST /api/rss/feed/processfeed
 * Accepts either feeds[] or url (string or array)
 */
export const feedProcessSchema = z.object({
  feeds: z.array(z.string()).optional(),
  url: z.union([z.string(), z.array(z.string())]).optional(),
  // Handle nested body (some clients send { body: { ... } })
  body: z.object({
    feeds: z.array(z.string()).optional(),
    url: z.union([z.string(), z.array(z.string())]).optional()
  }).optional()
}).refine(
  (data) => {
    const payload = data.body || data;
    return payload.feeds?.length > 0 || payload.url;
  },
  { message: 'You must provide feeds[] or url (string or array)' }
);

/**
 * POST /api/summarize/
 */
export const summarizeSchema = z.object({
  feeds: z.array(z.object({
    title: z.string().optional(),
    link: z.string().optional(),
    content: z.string().optional(),
    pubDate: z.string().optional(),
    source: z.string().optional()
  }).passthrough()).min(1, 'feeds array must not be empty')
});

/**
 * POST /api/transcript/summarize
 */
export const transcriptSummarizeSchema = z.object({
  transcripts: z.union([
    // Array of transcript objects or strings
    z.array(z.union([
      z.string(),
      z.object({
        content: z.string().optional(),
        title: z.string().optional()
      }).passthrough()
    ])).min(1, 'transcripts array must not be empty'),
    // Handle string that needs JSON parsing (legacy support)
    z.string().transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'transcripts must be an array'
          });
          return z.NEVER;
        }
        return parsed;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid JSON string in transcripts'
        });
        return z.NEVER;
      }
    })
  ])
});

/**
 * POST /api/intel/addintelurl
 * POST /api/intel/deleteintelurl
 */
export const intelUrlsSchema = z.object({
  urls: urlArraySchema
});

/**
 * POST /api/intel/getdailyintel
 */
export const dailyIntelSchema = z.object({
  date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Date must be in YYYY-MM-DD format'
  )
});

// ============================================
// Pre-built validation middleware
// ============================================

export const validateRssFetch = validate(rssFetchSchema);
export const validateFeedProcess = validate(feedProcessSchema);
export const validateSummarize = validate(summarizeSchema);
export const validateTranscriptSummarize = validate(transcriptSummarizeSchema);
export const validateIntelUrls = validate(intelUrlsSchema);
export const validateDailyIntel = validate(dailyIntelSchema);

// Export schemas for testing
export const schemas = {
  rssFetch: rssFetchSchema,
  feedProcess: feedProcessSchema,
  summarize: summarizeSchema,
  transcriptSummarize: transcriptSummarizeSchema,
  intelUrls: intelUrlsSchema,
  dailyIntel: dailyIntelSchema
};

# Genie RSS - Improvements & Security

## Table of Contents
- [Current Status](#current-status)
- [Security Improvements](#security-improvements)
- [Critical Issues](#critical-issues)
- [Performance Improvements](#performance-improvements)
- [Code Quality](#code-quality)
- [Architecture Improvements](#architecture-improvements)
- [Logging & Monitoring](#logging--monitoring)
- [Testing](#testing)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Dependencies](#dependencies)
- [Implementation Roadmap](#implementation-roadmap)
- [Changelog](#changelog)

---

## Current Status

| Feature | Status |
|---------|--------|
| API Key Authentication | ✅ Implemented |
| Timing-Safe Auth | ❌ Not implemented |
| Rate Limiting | ❌ Not implemented |
| Input Validation | ⚠️ Basic (URL format only) |
| SSRF Protection | ❌ Not implemented |
| Global Error Handler | ❌ Not implemented |
| Structured Logging | ❌ Not implemented |
| Request Caching | ❌ Not implemented |
| Unit Tests | ❌ None |
| API Documentation | ❌ Not implemented |

---

## Security Improvements

### 1. API Key Authentication (Implemented)

All API endpoints are now protected with API key authentication.

**How it works:**
- Set `API_KEY` in your `.env` file
- Include the key in request headers: `X-API-Key: your-api-key`
- Requests without a valid key will receive `401 Unauthorized`

**Example request:**
```bash
curl -X POST http://localhost:3001/api/rss/fetch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"url": "https://example.com"}'
```

**Unprotected endpoints:**
- `GET /health` - Health check (public)

### 2. Security Vulnerabilities to Fix

#### 2.1 Timing Attack Vulnerability
**File:** `src/middleware/auth.js:17`
**Problem:** Plain string comparison (`===`) for API key is vulnerable to timing attacks.

**Current Code:**
```javascript
if (apiKey !== validApiKey) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

**Recommended Fix:**
```javascript
import crypto from 'crypto';

const isValid = crypto.timingSafeEqual(
  Buffer.from(apiKey),
  Buffer.from(validApiKey)
);
```

#### 2.2 SSRF (Server-Side Request Forgery)
**Files:** `services/rssDiscovery.js`, `services/feedprocess.js`, `utils/scraper.js`
**Problem:** No validation of URLs - can fetch internal/private IPs.

**Recommended Fix:**
```javascript
function validateUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Block private/internal IPs
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.16.'];
  for (const range of blocked) {
    if (hostname.includes(range)) throw new Error('Private IP not allowed');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol');
  }
}
```

#### 2.3 No Rate Limiting
**Problem:** No protection against brute force attacks on API key.

**Recommended Fix:**
```javascript
const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Track failed attempts per IP
// Block after MAX_ATTEMPTS within WINDOW_MS
```

#### 2.4 Sensitive Data in Logs
**Files:** `routes/transcripts.js:18,35`, `routes/intel.js:53,107`
**Problem:** Full request bodies logged without sanitization.

**Recommended Fix:**
```javascript
function sanitizeForLogging(data) {
  const sensitive = ['password', 'apikey', 'token', 'secret'];
  // Redact sensitive fields before logging
}
```

---

## Critical Issues

### 1. No Global Error Handler
**File:** `src/index.js`
**Problem:** Unhandled promise rejections can crash the server.

**Recommended Fix:**
```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  // Don't exit in production, but log for monitoring
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Express error middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### 2. Silent Error Handling
**Files:** `services/feedprocess.js:130,250`, `services/otterTranscript.js:83`
**Problem:** Catch blocks return empty arrays without logging.

**Current Code:**
```javascript
} catch (err) {
  return [];
}
```

**Recommended Fix:**
```javascript
} catch (err) {
  console.error('[fetchDirect] Error:', { url, message: err.message });
  return [];
}
```

### 3. No Input Validation on URLs
**File:** `routes/intel.js:11-18`
**Problem:** URLs passed directly to axios without validation.

---

## Performance Improvements

### 1. Sequential Processing (10-50x Slower)
**File:** `routes/intel.js:23-44, 77-99`
**Problem:** URLs processed one-by-one in a for loop.

**Current Code:**
```javascript
for (let i = 0; i < urls.length; i++) {
  const response = await axios.post(...);
  results.push(...);
}
```

**Recommended Fix:**
```javascript
const results = await Promise.allSettled(
  urls.map(url =>
    axios.post(`${WEBHOOK_URL}/addintelurl`, { url })
      .then(res => ({ url, success: true, data: res.data }))
      .catch(err => ({ url, success: false, error: err.message }))
  )
);
```

### 2. No RSS Feed Caching
**File:** `services/rssFetcher.js`
**Problem:** Every request re-fetches and re-parses the same feeds.

**Recommended Fix:**
```javascript
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour

export async function fetchAndParseRss(feedUrl) {
  const cached = cache.get(feedUrl);
  if (cached) return cached;

  const result = await parser.parseURL(feedUrl);
  cache.set(feedUrl, result);
  return result;
}
```

### 3. No Request Deduplication
**File:** `routes/feed.js`
**Problem:** Simultaneous requests to same URL spawn independent fetches.

### 4. Hardcoded Timeouts
**Files:** `feedprocess.js:116,137,150`, `scraper.js:17`
**Problem:** Timeouts (10000, 15000, 30000ms) hardcoded, not configurable.

---

## Code Quality

### 1. Duplicate Code
**File:** `routes/intel.js:9-59, 63-113`
**Problem:** `/addintelurl` and `/deleteintelurl` have nearly identical implementations.

**Recommended Fix:**
```javascript
async function forwardToWebhook(urls, endpoint) {
  return Promise.allSettled(
    urls.map(url =>
      axios.post(`${WEBHOOK_URL}/${endpoint}`, { url })
        .then(res => ({ url, success: true, data: res.data }))
        .catch(err => ({ url, success: false, error: err.message }))
    )
  );
}

router.post('/addintelurl', async (req, res) => {
  const results = await forwardToWebhook(req.body.urls, 'addintelurl');
  res.json({ success: true, results });
});
```

### 2. Commented-Out Code
**File:** `services/feedprocess.js:32-44`
**Problem:** Commented webhook code clutters the file.

### 3. Inconsistent Error Messages
**Files:** Multiple routes
**Problem:** Generic "Failed to process request" doesn't help debugging.

---

## Architecture Improvements

### 1. No Request/Response Validation
**Problem:** Manual validation scattered throughout routes.

**Recommended Fix (using Zod):**
```javascript
import { z } from 'zod';

const FeedSchema = z.object({
  feeds: z.array(z.string().url()).min(1),
});

router.post("/", async (req, res) => {
  const validated = FeedSchema.parse(req.body);
  // Use validated.feeds safely
});
```

### 2. Tight Coupling
**Problem:** Routes import directly from services, hard to test or swap implementations.

### 3. Missing Dependency Injection
**Problem:** Global singletons (LLM instances) hard to mock for testing.

### 4. Suggested File Structure
```
src/
├── config/
│   └── index.js          # Centralized configuration
├── middleware/
│   ├── auth.js           # API key authentication
│   ├── errorHandler.js   # Global error handler
│   ├── validator.js      # Request validation
│   └── requestLogger.js  # Request logging
├── services/
│   └── ...
├── routes/
│   └── ...
├── utils/
│   ├── logger.js         # Structured logging
│   ├── urlValidator.js   # URL/SSRF validation
│   └── cache.js          # Feed caching
└── test/
    ├── unit/
    └── integration/
```

---

## Logging & Monitoring

### 1. Inconsistent Logging
**Problem:** Mix of `console.log`, `console.error`, `console.warn` with no structure.

**Recommended Fix:**
```javascript
// utils/logger.js
class Logger {
  log(level, message, meta = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    }));
  }

  info(msg, meta) { this.log('INFO', msg, meta); }
  warn(msg, meta) { this.log('WARN', msg, meta); }
  error(msg, meta) { this.log('ERROR', msg, meta); }
}

export default new Logger();
```

### 2. No Request ID Tracking
**Problem:** Can't correlate logs across a single request.

### 3. No Performance Metrics
**Problem:** Can't identify slow endpoints.

---

## Testing

### 1. No Tests Exist
**Problem:** Zero test files in the codebase.

**Recommended Setup:**
```json
// package.json
{
  "scripts": {
    "test": "node --test test/**/*.test.js",
    "test:coverage": "c8 npm test"
  },
  "devDependencies": {
    "c8": "^7.13.0",
    "supertest": "^6.3.4"
  }
}
```

**Example Test:**
```javascript
// test/routes/rss.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../../src/index.js';

describe('POST /api/rss/fetch', () => {
  it('should require API key', async () => {
    const res = await request(app).post('/api/rss/fetch');
    assert.strictEqual(res.status, 401);
  });
});
```

---

## Configuration

### Environment Variables

```env
# Required - API Protection
API_KEY=your-secure-api-key-here

# Required - AI Features
OPENAI_API_KEY=your-openai-key

# Required - Feed Processing
SCRAPINGBEE_API_KEY=your-scrapingbee-key

# Optional
WEBHOOK_URL=https://your-webhook.com
NEWSLETTER_EMAIL=email@gmail.com
NEWSLETTER_PASSWORD=app-password
PORT=3001

# Recommended (not yet implemented)
NODE_ENV=development
LOG_LEVEL=info
CACHE_TTL=3600
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
API_TIMEOUT=15000
```

### Hardcoded Values to Externalize
| Value | Location | Current | Recommended |
|-------|----------|---------|-------------|
| Timeout | `scraper.js:17` | `15000` | `process.env.API_TIMEOUT` |
| Timeout | `feedprocess.js:116` | `10000` | `process.env.RSS_TIMEOUT` |
| Body limit | `transcripts.js:7` | `10mb` | `process.env.MAX_BODY_SIZE` |
| Max items | `scraper.js:47` | `20` | `process.env.MAX_SCRAPE_ITEMS` |

---

## Documentation

### Missing Documentation
- No JSDoc on any functions
- No OpenAPI/Swagger specification
- No inline comments on complex logic (`feedprocess.js:176-204`)

### Recommended JSDoc Example
```javascript
/**
 * Discover RSS feed URL from a website
 * @async
 * @param {string} url - The website URL to check
 * @returns {Promise<string|null>} RSS feed URL or null if not found
 * @throws {Error} If URL is invalid or unreachable
 */
export async function discoverRssFeed(url) {
  // ...
}
```

---

## Dependencies

### Outdated Packages
| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| axios | ^1.6.0 | 1.7.x | Update recommended |
| cheerio | ^1.0.0-rc.12 | 1.2.0 | Stable release available |

### Missing Dev Dependencies
```json
{
  "devDependencies": {
    "eslint": "^8.57.0",
    "prettier": "^3.2.5",
    "c8": "^7.13.0",
    "supertest": "^6.3.4",
    "node-cache": "^5.1.2"
  }
}
```

### Security Audit
Run regularly:
```bash
npm audit
npm outdated
```

---

## Implementation Roadmap

### Phase 1: Critical (Do First)
| Task | Priority | Effort |
|------|----------|--------|
| Add timing-safe API key comparison | Critical | Low |
| Add global error handler | Critical | Low |
| Add URL validation (SSRF protection) | Critical | Medium |
| Set up basic test framework | Critical | Medium |

### Phase 2: High Priority
| Task | Priority | Effort |
|------|----------|--------|
| Add structured logging | High | Medium |
| Implement request caching | High | Medium |
| Parallelize webhook calls | High | Low |
| Add rate limiting | High | Medium |
| Extract duplicate route code | High | Low |

### Phase 3: Medium Priority
| Task | Priority | Effort |
|------|----------|--------|
| Add request/response validation (Zod) | Medium | Medium |
| Externalize hardcoded config | Medium | Low |
| Add JSDoc documentation | Medium | Medium |
| Set up OpenAPI/Swagger docs | Medium | High |
| Add performance metrics | Medium | Medium |

### Phase 4: Low Priority
| Task | Priority | Effort |
|------|----------|--------|
| Add dependency injection | Low | High |
| Implement JWT auth option | Low | High |
| Add API key rotation | Low | Medium |
| Set up CI/CD pipeline | Low | Medium |

---

## Changelog

### v1.1.0 - Security Update
- Added API key authentication middleware
- Protected all API routes except health check
- Created security documentation
- Added `.env.example` with required variables
- Updated README with API key examples

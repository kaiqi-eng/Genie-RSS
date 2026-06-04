# Genie RSS

A Node.js API that retrieves RSS feeds from websites. If a website doesn't have an RSS feed, Genie RSS automatically generates one from the page content.

## Features

- **RSS Discovery**: Automatically finds RSS/Atom feeds from websites
- **RSS Generation**: Creates RSS feeds from scraped content when no feed exists
- **Modern React UI**: Beautiful frontend to test feed retrieval
- **Full Content Extraction**: Extracts articles, posts, and content from web pages

## Project Structure

```
Genie-RSS/
├── backend/           # Node.js Express API
│   └── src/
│       ├── index.js              # Server entry point
│       ├── routes/rss.js         # API routes
│       ├── services/
│       │   ├── rssDiscovery.js   # Find RSS feeds
│       │   ├── rssFetcher.js     # Parse RSS feeds
│       │   └── rssGenerator.js   # Generate RSS from content
│       └── utils/scraper.js      # Web scraping utilities
├── frontend/          # React (Vite) frontend
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── UrlInput.jsx
│       │   └── FeedDisplay.jsx
│       └── services/api.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your API keys
   ```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | Yes | Your API key for authenticating requests |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI summarization |
| `SCRAPINGBEE_API_KEY` | Yes | ScrapingBee API key for feed processing |
| `YOUTUBE_API_KEY` | No | YouTube Data API key (preferred path for `/api/youtube/resolve-channels`; web fallback is used if missing) |
| `WEBHOOK_URL` | No | Webhook URL for intelligence delivery |
| `NEWSLETTER_EMAIL` | No | Gmail for newsletter extraction |
| `NEWSLETTER_PASSWORD` | No | Gmail app password |
| `PORT` | No | Server port (default: 3001) |
| `LLM_TIMEOUT` | No | LLM API timeout in ms (default: 60000) |

### Running the Application

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```
   The API will run on http://localhost:3001

2. **Start the frontend (in a new terminal):**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on http://localhost:3000

### API Documentation

Swagger documentation is available at:
- **Swagger UI**: http://localhost:3001/api-docs
- **OpenAPI JSON**: http://localhost:3001/api-docs.json

### Mock Webhook Server (for local testing)

The Intel API endpoints (`/api/intel/*`) forward requests to an external webhook. For local testing, use the included mock server:

1. **Set webhook URL in `.env`:**
   ```bash
   WEBHOOK_URL=http://localhost:4000
   ```

2. **Start the mock webhook server:**
   ```bash
   cd backend
   npm run webhook
   ```
   The mock server runs on http://localhost:4000

3. **Available mock endpoints:**
   | Endpoint | Description |
   |----------|-------------|
   | `POST /addintelurl` | Add URL to tracking (in-memory) |
   | `POST /deleteintelurl` | Remove URL from tracking |
   | `POST /getdailyintel` | Get tracked URLs as RSS items |
   | `GET /status` | View all tracked URLs |

4. **Test the Intel API:**
   ```bash
   # Add URLs
   curl -X POST 'http://localhost:3001/api/intel/addintelurl' \
     -H 'Content-Type: application/json' \
     -H 'X-API-Key: your_secure_api_key_here' \
     -d '{"urls": ["https://example.com/article"]}'

   # Check mock server status
   curl http://localhost:4000/status
   ```

### Usage

1. Open http://localhost:3000 in your browser
2. Enter a website URL (e.g., `techcrunch.com`)
3. Click "Get RSS Feed"
4. View the discovered or generated RSS feed

## API Endpoints

Swagger is the source of truth for request/response shapes:
- **Swagger UI**: http://localhost:3001/api-docs
- **OpenAPI JSON**: http://localhost:3001/api-docs.json

### Auth Types

- **API Key (`X-API-Key`)**: Required for routes under `/api/*`
- **Bearer (`Authorization: Bearer <token>`)**: Required for `/mcp/*`; optional/conditional for `/audit/*` depending on `AUDIT_REQUIRE_AUTH=true`
- **No auth**: `/`, `/health`, `/auth/token`, `/api-docs`, `/api-docs.json`

### Route Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | Root status endpoint |
| GET | `/health` | None | Service health check |
| POST | `/auth/token` | None | Create bearer token using `AUTH_EMAIL`/`AUTH_PASSWORD` |
| GET | `/audit/health` | Bearer (optional by env) | Audit route health/context |
| POST | `/audit/test` | Bearer (optional by env) | Test audit logging payload/metadata |
| GET | `/mcp/health` | Bearer | MCP health/context |
| POST | `/mcp` | Bearer | MCP JSON-RPC endpoint (`tools/list`, `tools/call`) |
| POST | `/api/rss/fetch` | API Key | Discover or generate RSS for URL |
| POST | `/api/rss/feed/processfeed` | API Key | Process one or more feed URLs |
| POST | `/api/summarize` | API Key | Summarize feed items |
| POST | `/api/transcript/summarize` | API Key | Summarize transcript content |
| POST | `/api/intel/addintelurl` | API Key | Add URLs to intel pipeline |
| POST | `/api/intel/deleteintelurl` | API Key | Remove URLs from intel pipeline |
| POST | `/api/intel/getdailyintel` | API Key | Retrieve daily intel for date |
| POST | `/api/youtube/resolve-channels` | API Key | Resolve channel names to YouTube channel URLs and RSS feed URLs |

### Example: Fetch RSS

```bash
curl -X POST "http://localhost:3001/api/rss/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d "{\"url\":\"https://example.com\"}"
```

## How It Works

1. **Discovery Phase**: The API first looks for RSS/Atom links in the HTML `<head>` section and checks common feed URL patterns (`/feed`, `/rss.xml`, etc.)

2. **Fetch Phase**: If a feed is found, it's fetched and parsed using `rss-parser`

3. **Generation Phase**: If no feed exists, the page content is scraped using `cheerio`. Articles and posts are extracted, and a valid RSS 2.0 feed is generated using the `feed` library

## Technologies

**Backend:**
- Express.js - API framework
- axios - HTTP client
- cheerio - HTML parsing
- rss-parser - RSS feed parsing
- feed - RSS generation

**Frontend:**
- React 18
- Vite - Build tool
- Vanilla CSS with modern features

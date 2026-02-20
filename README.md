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

### Usage

1. Open http://localhost:3000 in your browser
2. Enter a website URL (e.g., `techcrunch.com`)
3. Click "Get RSS Feed"
4. View the discovered or generated RSS feed

## API Endpoints

### POST /api/rss/fetch

Fetches or generates an RSS feed for a given URL.

**Where to call it**

- **Directly to the backend**: `http://localhost:3001/api/rss/fetch`
- **Via the frontend dev server (Vite proxy)**: `http://localhost:3000/api/rss/fetch`  
  The frontend proxies any request starting with `/api` to `http://localhost:3001` (see `frontend/vite.config.js`).

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Example (curl):**
```bash
# direct to backend
curl -X POST "http://localhost:3001/api/rss/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"url":"https://example.com"}'

# via Vite proxy (when frontend dev server is running)
curl -X POST "http://localhost:3000/api/rss/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{"url":"https://example.com"}'
```

**Example (browser fetch):**
```js
async function getFeed(url) {
  const res = await fetch("/api/rss/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "your-api-key-here"
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

getFeed("https://example.com").then(console.log);
```

**Response:**
```json
{
  "source": "discovered" | "generated",
  "feedUrl": "https://example.com/feed" | null,
  "feed": {
    "title": "Feed Title",
    "description": "Feed description",
    "items": [...]
  },
  "rssXml": "<?xml version=\"1.0\"...>" // Only for generated feeds
}
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

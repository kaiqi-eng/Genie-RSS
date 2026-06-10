# Testing LinkedIn Scraping Endpoints

This document provides instructions and standard curl commands to test the newly integrated Apify LinkedIn scraping endpoints.

## Prerequisites

1. Ensure the backend server is running:
   ```bash
   cd backend
   npm run dev
   ```
2. Make sure the API key configured in `.env` is correct. The default key is `testing`.

---

## 1. Test Profile Posts Endpoint

Retrieves recent posts from a specific LinkedIn profile.

```bash
curl -X POST http://localhost:3001/api/linkedin/profile-posts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: testing" \
  -d '{
    "profileUrl": "https://www.linkedin.com/in/satyanadella/",
    "maxPosts": 3
  }'
```

---

## 2. Test Topic Search Posts Endpoint

Searches for recent posts matching a specific topic/keyword on LinkedIn.

```bash
curl -X POST http://localhost:3001/api/linkedin/topic-posts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: testing" \
  -d '{
    "topic": "artificial intelligence",
    "maxPosts": 3
  }'
```

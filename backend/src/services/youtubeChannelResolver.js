import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { timeouts } from '../config/index.js';

const logger = createLogger('services:youtubeChannelResolver');

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_SEARCH_URL = 'https://www.youtube.com/results';
const YOUTUBE_FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const YOUTUBE_CHANNEL_BASE = 'https://www.youtube.com/channel/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function buildResult(inputName, data = {}) {
  const channelId = data.channelId || null;
  const found = Boolean(channelId);

  return {
    inputName,
    found,
    channelId,
    channelUrl: channelId ? `${YOUTUBE_CHANNEL_BASE}${channelId}` : null,
    rssUrl: channelId ? `${YOUTUBE_FEED_BASE}${channelId}` : null,
    matchedTitle: data.matchedTitle || null,
    source: data.source || 'none',
    ...(data.error ? { error: data.error } : {}),
  };
}

function decodeEscapedText(value = '') {
  try {
    return JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
}

function extractFromYouTubeSearchHtml(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return null;
  }

  const primaryRegex = /"channelRenderer":\{"channelId":"(UC[\w-]{22})"[\s\S]*?"title":\{"simpleText":"([^"]+)"/;
  const primaryMatch = html.match(primaryRegex);
  if (primaryMatch) {
    return {
      channelId: primaryMatch[1],
      matchedTitle: decodeEscapedText(primaryMatch[2]),
    };
  }

  const alternateRegex = /"channelRenderer":\{"channelId":"(UC[\w-]{22})"[\s\S]*?"title":\{"runs":\[\{"text":"([^"]+)"/;
  const alternateMatch = html.match(alternateRegex);
  if (alternateMatch) {
    return {
      channelId: alternateMatch[1],
      matchedTitle: decodeEscapedText(alternateMatch[2]),
    };
  }

  const idOnlyRegex = /"channelId":"(UC[\w-]{22})"/;
  const idOnlyMatch = html.match(idOnlyRegex);
  if (idOnlyMatch) {
    return {
      channelId: idOnlyMatch[1],
      matchedTitle: null,
    };
  }

  return null;
}

export async function searchViaYouTubeApi(channelName) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await axios.get(YOUTUBE_API_URL, {
    params: {
      part: 'snippet',
      type: 'channel',
      q: channelName,
      maxResults: 1,
      key: apiKey,
    },
    timeout: timeouts.rssDiscoveryFast,
  });

  const item = response?.data?.items?.[0];
  const channelId = item?.id?.channelId;

  if (!channelId) {
    return null;
  }

  return {
    channelId,
    matchedTitle: item?.snippet?.title || null,
    source: 'youtube_api',
  };
}

export async function searchViaWebFallback(channelName) {
  const response = await axios.get(YOUTUBE_SEARCH_URL, {
    params: {
      search_query: channelName,
      sp: 'EgIQAg%3D%3D',
    },
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: timeouts.rssDiscovery || 10000,
  });

  const parsed = extractFromYouTubeSearchHtml(response?.data);
  if (!parsed?.channelId) {
    return null;
  }

  return {
    ...parsed,
    source: 'web_fallback',
  };
}

export async function resolveChannels(channelNames) {
  const results = [];

  for (const rawName of channelNames) {
    const inputName = rawName.trim();

    try {
      let resolved = null;
      let apiError = null;

      try {
        resolved = await searchViaYouTubeApi(inputName);
      } catch (error) {
        apiError = error;
        logger.warn('YouTube API lookup failed; using fallback', { inputName, error: error.message });
      }

      if (!resolved) {
        try {
          resolved = await searchViaWebFallback(inputName);
        } catch (fallbackError) {
          logger.warn('YouTube web fallback lookup failed', { inputName, error: fallbackError.message });
          const errorMessage = apiError
            ? `YouTube API lookup failed (${apiError.message}); fallback lookup failed (${fallbackError.message})`
            : `Fallback lookup failed (${fallbackError.message})`;
          results.push(buildResult(inputName, { source: 'none', error: errorMessage }));
          continue;
        }
      }

      if (!resolved) {
        results.push(buildResult(inputName, { source: 'none' }));
        continue;
      }

      results.push(buildResult(inputName, resolved));
    } catch (error) {
      logger.error('Unexpected channel resolution error', { inputName, error });
      results.push(buildResult(inputName, { source: 'none', error: error.message }));
    }
  }

  return results;
}

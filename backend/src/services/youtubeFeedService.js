import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { timeouts } from '../config/index.js';
import { searchViaYouTubeApi } from './youtubeChannelResolver.js';

const logger = createLogger('services:youtubeFeedService');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_CHANNEL_BASE = 'https://www.youtube.com/channel/';
const YOUTUBE_WATCH_BASE = 'https://www.youtube.com/watch?v=';
const YOUTUBE_FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

export class YouTubeFeedError extends Error {
  constructor(message, { code = 'YOUTUBE_FEED_ERROR', statusCode = 502, cause } = {}) {
    super(message);
    this.name = 'YouTubeFeedError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

function toIsoStringOrNull(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function buildContentSnippet(content) {
  if (!content) return '';
  return content.length <= 200 ? content : content.substring(0, 200);
}

function pickThumbnail(thumbnails = {}) {
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    null
  );
}

function getApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YouTubeFeedError('YOUTUBE_API_KEY is required for YouTube feed fetches', {
      code: 'MISSING_YOUTUBE_API_KEY',
      statusCode: 424,
    });
  }
  return apiKey;
}

function parseYouTubeUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function extractReference(parsedUrl) {
  if (!parsedUrl) return { type: 'unknown', value: null };
  const host = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname || '/';
  const segments = pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return { type: 'videoId', value: segments[0] || null };
  }

  if (segments[0] === 'watch') {
    return { type: 'videoId', value: parsedUrl.searchParams.get('v') };
  }

  if (segments[0] === 'channel' && segments[1]) {
    return { type: 'channelId', value: segments[1] };
  }

  if (segments[0] === 'user' && segments[1]) {
    return { type: 'username', value: segments[1] };
  }

  if (segments[0] === 'c' && segments[1]) {
    return { type: 'customName', value: segments[1] };
  }

  if (pathname.startsWith('/@')) {
    return { type: 'handle', value: pathname.slice(2) };
  }

  if (segments[0] === 'feeds' && segments[1] === 'videos.xml') {
    return { type: 'channelId', value: parsedUrl.searchParams.get('channel_id') };
  }

  return { type: 'unknown', value: null };
}

export function isYouTubeUrl(rawUrl) {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed) return false;
  return YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
}

async function requestYoutubeApi(path, params, apiKey) {
  const response = await axios.get(`${YOUTUBE_API_BASE}${path}`, {
    params: {
      ...params,
      key: apiKey,
    },
    timeout: timeouts.rssDiscoveryFast,
  });

  return response?.data;
}

async function fetchChannelById(channelId, apiKey) {
  if (!channelId) return null;
  const data = await requestYoutubeApi('/channels', {
    part: 'snippet,contentDetails',
    id: channelId,
    maxResults: 1,
  }, apiKey);
  return data?.items?.[0] || null;
}

async function fetchChannelByHandle(handle, apiKey) {
  if (!handle) return null;
  const data = await requestYoutubeApi('/channels', {
    part: 'snippet,contentDetails',
    forHandle: handle.startsWith('@') ? handle : `@${handle}`,
    maxResults: 1,
  }, apiKey);
  return data?.items?.[0] || null;
}

async function fetchChannelByUsername(username, apiKey) {
  if (!username) return null;
  const data = await requestYoutubeApi('/channels', {
    part: 'snippet,contentDetails',
    forUsername: username,
    maxResults: 1,
  }, apiKey);
  return data?.items?.[0] || null;
}

async function fetchVideoSnippet(videoId, apiKey) {
  if (!videoId) return null;
  const data = await requestYoutubeApi('/videos', {
    part: 'snippet',
    id: videoId,
    maxResults: 1,
  }, apiKey);
  return data?.items?.[0] || null;
}

async function resolveChannelFromUrl(rawUrl, apiKey) {
  const parsed = parseYouTubeUrl(rawUrl);
  const reference = extractReference(parsed);

  switch (reference.type) {
    case 'channelId':
      return fetchChannelById(reference.value, apiKey);
    case 'handle':
      return fetchChannelByHandle(reference.value, apiKey);
    case 'username':
      return fetchChannelByUsername(reference.value, apiKey);
    case 'videoId': {
      const video = await fetchVideoSnippet(reference.value, apiKey);
      const channelId = video?.snippet?.channelId || null;
      return fetchChannelById(channelId, apiKey);
    }
    case 'customName': {
      const fallback = await searchViaYouTubeApi(reference.value);
      if (!fallback?.channelId) return null;
      return fetchChannelById(fallback.channelId, apiKey);
    }
    default:
      return null;
  }
}

async function fetchUploads(uploadsPlaylistId, apiKey, maxResults = 25) {
  const data = await requestYoutubeApi('/playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults,
  }, apiKey);

  return Array.isArray(data?.items) ? data.items : [];
}

function filterBySince(items, since) {
  const normalizedSince = toIsoStringOrNull(since);
  if (!normalizedSince) return items;
  const sinceTs = Date.parse(normalizedSince);

  return items.filter((item) => {
    const itemTs = Date.parse(item.pubDate || '');
    return !Number.isNaN(itemTs) && itemTs >= sinceTs;
  });
}

function mapItems(playlistItems, channel) {
  const channelTitle = channel?.snippet?.title || '';

  return playlistItems.map((item) => {
    const videoId = item?.snippet?.resourceId?.videoId || '';
    const title = item?.snippet?.title || 'Untitled';
    const content = item?.snippet?.description || '';
    const pubDate = item?.contentDetails?.videoPublishedAt || item?.snippet?.publishedAt || null;
    const creator = item?.snippet?.videoOwnerChannelTitle || channelTitle;

    return {
      title,
      link: videoId ? `${YOUTUBE_WATCH_BASE}${videoId}` : '',
      pubDate,
      creator,
      content,
      contentSnippet: buildContentSnippet(content),
      categories: [],
      guid: videoId ? `yt:video:${videoId}` : item?.id || title,
      thumbnail: pickThumbnail(item?.snippet?.thumbnails),
    };
  });
}

export async function buildYouTubeFeedFromUrl(rawUrl, options = {}) {
  const { since } = options;
  const apiKey = getApiKey();

  try {
    const channel = await resolveChannelFromUrl(rawUrl, apiKey);
    if (!channel?.id) {
      throw new YouTubeFeedError('Unable to resolve YouTube channel from URL', {
        code: 'YOUTUBE_CHANNEL_NOT_FOUND',
        statusCode: 404,
      });
    }

    const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new YouTubeFeedError('YouTube channel uploads playlist is unavailable', {
        code: 'YOUTUBE_UPLOADS_PLAYLIST_MISSING',
        statusCode: 502,
      });
    }

    const rawItems = await fetchUploads(uploadsPlaylistId, apiKey);
    const mappedItems = mapItems(rawItems, channel);
    const items = filterBySince(mappedItems, since);
    const lastBuildDate = items[0]?.pubDate || null;
    const feedUrl = `${YOUTUBE_FEED_BASE}${channel.id}`;

    const feed = {
      title: channel?.snippet?.title || 'YouTube Channel',
      description: channel?.snippet?.description || '',
      link: `${YOUTUBE_CHANNEL_BASE}${channel.id}`,
      language: 'en',
      lastBuildDate,
      items,
      _fetchedAt: new Date().toISOString(),
      _cache: {
        hit: false,
        key: `youtube-api:${channel.id}:since:${toIsoStringOrNull(since) || 'none'}`,
        ttl: null,
      },
    };

    return {
      channelId: channel.id,
      feedUrl,
      feed,
    };
  } catch (error) {
    if (error instanceof YouTubeFeedError) {
      throw error;
    }

    logger.error('Failed to build YouTube feed from API', { url: rawUrl, error });
    throw new YouTubeFeedError(`YouTube API feed generation failed: ${error.message}`, {
      code: 'YOUTUBE_API_FAILURE',
      statusCode: 502,
      cause: error,
    });
  }
}

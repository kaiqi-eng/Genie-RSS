import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

/**
 * Fetch and parse an RSS feed
 * @param {string} feedUrl - The URL of the RSS feed
 * @returns {object} - Parsed feed data
 */
export async function fetchAndParseRss(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    
    return {
      title: feed.title || 'Untitled Feed',
      description: feed.description || '',
      link: feed.link || feedUrl,
      language: feed.language || 'en',
      lastBuildDate: feed.lastBuildDate || null,
      items: (feed.items || []).map(item => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || null,
        creator: item.creator || item.author || '',
        content: item.contentEncoded || item.content || item.contentSnippet || '',
        contentSnippet: item.contentSnippet || '',
        categories: item.categories || [],
        guid: item.guid || item.id || item.link,
        thumbnail: extractThumbnail(item)
      }))
    };
  } catch (error) {
    console.error('Error fetching RSS feed:', error.message);
    throw new Error(`Failed to fetch RSS feed: ${error.message}`);
  }
}

/**
 * Extract thumbnail from feed item
 * @param {object} item - Feed item
 * @returns {string|null} - Thumbnail URL or null
 */
function extractThumbnail(item) {
  if (item.mediaContent && item.mediaContent.$) {
    return item.mediaContent.$.url;
  }
  if (item.mediaThumbnail && item.mediaThumbnail.$) {
    return item.mediaThumbnail.$.url;
  }
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  return null;
}

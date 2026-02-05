import { Feed } from 'feed';

/**
 * Generate an RSS feed from scraped website data
 * @param {string} siteUrl - The original website URL
 * @param {object} scrapedData - Data scraped from the website
 * @returns {object} - Generated feed in both JSON and XML formats
 */
export function generateRssFeed(siteUrl, scrapedData) {
  const feed = new Feed({
    title: scrapedData.title || 'Generated Feed',
    description: scrapedData.description || `Auto-generated RSS feed for ${siteUrl}`,
    id: siteUrl,
    link: siteUrl,
    language: 'en',
    image: scrapedData.favicon,
    favicon: scrapedData.favicon,
    copyright: `Content from ${scrapedData.siteName || new URL(siteUrl).hostname}`,
    updated: new Date(),
    generator: 'Genie-RSS Feed Generator',
    feedLinks: {
      rss: `${siteUrl}/feed`
    }
  });

  // Add items to the feed
  for (const item of scrapedData.items) {
    feed.addItem({
      title: item.title,
      id: item.link,
      link: item.link,
      description: item.content || item.title,
      content: item.content || '',
      date: item.pubDate ? new Date(item.pubDate) : new Date(),
      image: item.thumbnail
    });
  }

  // Generate both XML and JSON representations
  const rssXml = feed.rss2();
  
  const jsonFeed = {
    title: scrapedData.title,
    description: scrapedData.description,
    link: siteUrl,
    language: 'en',
    lastBuildDate: new Date().toISOString(),
    items: scrapedData.items.map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate || new Date().toISOString(),
      content: item.content || '',
      contentSnippet: (item.content || '').substring(0, 200),
      thumbnail: item.thumbnail,
      guid: item.link
    }))
  };

  return {
    xml: rssXml,
    json: jsonFeed
  };
}

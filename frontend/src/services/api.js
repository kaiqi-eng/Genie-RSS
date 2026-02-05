const API_BASE = '/api';

/**
 * Fetch RSS feed for a given URL
 * @param {string} url - The website URL
 * @returns {Promise<object>} - Feed data
 */
export async function fetchRssFeed(url) {
  const response = await fetch(`${API_BASE}/rss/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to fetch feed');
  }

  return response.json();
}

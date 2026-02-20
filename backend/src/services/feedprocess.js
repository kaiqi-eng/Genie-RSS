/**
 * BHA Third Eye Engine Service
 * Node.js v2.2 (Enhanced)
 */

import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import xml2js from "xml2js";
import crypto from "crypto";
import zlib from "zlib";
import imaps from "imap-simple";
import * as cheerio from "cheerio";
import { validateUrl, isValidUrl } from "../utils/urlValidator.js";
import { credentials, timeouts } from "../config/index.js";

// ---------------- CONFIG ----------------

// Lazy-loaded credentials (allows tests to run without all env vars)
const getScrapingBeeKey = () => {
  const key = credentials.scrapingBeeApiKey;
  if (!key) {
    throw new Error("Missing SCRAPINGBEE_API_KEY in .env");
  }
  return key;
};
const NEWSLETTER_EMAIL = credentials.newsletter.email;
const NEWSLETTER_PASSWORD = credentials.newsletter.password;
const WEBHOOK_URL = credentials.webhookUrl;

// ---------------- HELPERS ----------------

export const hashId = (...parts) =>
  crypto.createHash("md5").update(parts.join("")).digest("hex");

// export const sendToWebhook = async (payload) => {
//   if (!WEBHOOK_URL) return { status: "disabled" };

//   try {
//     const response = await axios.post(WEBHOOK_URL, payload, {
//       headers: { "Content-Type": "application/json" },
//       timeout: 20000,
//     });
//     return { status: "delivered", code: response.status };
//   } catch (err) {
//     return { status: "failed", error: err.message };
//   }
// };

// ---------------- RSS PARSER ----------------

export const parseRSS = async (xml, source = "unknown", tier = "direct") => {
  const items = [];
  try {
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
    });

    const feedItems =
      parsed?.rss?.channel?.item ||
      parsed?.feed?.entry ||
      [];

    const list = Array.isArray(feedItems) ? feedItems : [feedItems];

    for (const el of list.slice(0, 25)) {
      const title = el.title?._ || el.title || "";
      const link = el.link?.href || el.link || "";
      const content =
        el.description || el.summary || el.content || "";
      const published =
        el.pubDate || el.published || el.updated || "";

      if (title && link) {
        items.push({
          id: hashId(link, published),
          title: title.slice(0, 200),
          url: link,
          content: String(content).slice(0, 4000),
          published,
          source,
          tier,
        });
      }
    }
  } catch {
    return [];
  }
  return items;
};

// ---------------- FEED DISCOVERY ----------------

const discoverFeedUrls = (html, baseUrl) => {
  const $ = cheerio.load(html);
  const feeds = new Set();

  $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each(
    (_, el) => {
      let href = $(el).attr("href");
      if (!href) return;

      if (href.startsWith("/")) {
        href = new URL(href, baseUrl).href;
      }

      // Validate discovered feed URLs for SSRF protection
      if (isValidUrl(href)) {
        feeds.add(href);
      }
    }
  );

  return [...feeds];
};

// ---------------- FETCHERS ----------------

export const fetchDirect = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: timeouts.feedProcess,
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/rss+xml, application/xml",
      },
    });

    let data = response.data;
    if (response.headers["content-encoding"] === "gzip") {
      data = zlib.gunzipSync(data);
    }

    return await parseRSS(data.toString("utf-8"), url, "direct");
  } catch {
    return [];
  }
};

const fetchHtmlDirect = async (url) => {
  const response = await axios.get(url, {
    timeout: timeouts.feedProcess,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return response.data;
};

const fetchHtmlViaScrapingBee = async (url) => {
  const response = await axios.get("https://api.scrapingbee.com/v1/", {
    params: {
      api_key: getScrapingBeeKey(),
      url,
      render_js: true,
      premium_proxy: true,
    },
    timeout: timeouts.scrapingBee,
  });
  return response.data;
};

export const fetchViaScrapingBee = async (url) => {
  try {
    const response = await axios.get("https://api.scrapingbee.com/v1/", {
      params: {
        api_key: getScrapingBeeKey(),
        url,
        render_js: true,
        premium_proxy: true,
      },
      timeout: timeouts.scrapingBee,
    });

    return await parseRSS(response.data, url, "third_eye");
  } catch {
    return [];
  }
};

// ---------------- SMART FETCH (FIXED) ----------------

export const smartFetch = async (url) => {
  // Validate URL for SSRF protection
  validateUrl(url);

  // 1️⃣ Direct RSS
  const direct = await fetchDirect(url);
  if (direct.length) return direct;

  // 2️⃣ HTML → discover RSS
  try {
    const html = await fetchHtmlDirect(url);
    const feeds = discoverFeedUrls(html, url);

    for (const feedUrl of feeds) {
      const items = await fetchDirect(feedUrl);
      if (items.length) return items;
    }
  } catch {}

  // 3️⃣ ScrapingBee HTML → discover RSS (blocked sites)
  try {
    const html = await fetchHtmlViaScrapingBee(url);
    const feeds = discoverFeedUrls(html, url);

    for (const feedUrl of feeds) {
      const items = await fetchDirect(feedUrl);
      if (items.length) return items;
    }
  } catch {}

  // 4️⃣ ScrapingBee RSS fallback
  return fetchViaScrapingBee(url);
};

// ---------------- NEWSLETTER FETCHER ----------------

export const fetchNewsletters = async () => {
  if (!NEWSLETTER_EMAIL || !NEWSLETTER_PASSWORD) return [];

  try {
    const connection = await imaps.connect({
      imap: {
        user: NEWSLETTER_EMAIL,
        password: NEWSLETTER_PASSWORD,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
      },
    });

    await connection.openBox("INBOX");
    const results = await connection.search(["UNSEEN"], {
      bodies: ["HEADER", "TEXT"],
    });

    return results.map((r) => ({
      id: hashId(
        r.parts[0].body.subject?.[0] || "",
        r.parts[0].body.date?.[0] || ""
      ),
      title: r.parts[0].body.subject?.[0] || "",
      url: "email",
      content: (r.parts[1]?.body || "").slice(0, 4000),
      published: r.parts[0].body.date?.[0] || "",
      source: "newsletter",
      tier: "newsletter",
    }));
  } catch {
    return [];
  }
};

// ---------------- COLLECTOR ----------------

export const collectIntel = async (feeds = []) => {
  const results = [];

  for (const f of feeds) {
    if (typeof f === "string") {
      const fetched = await smartFetch(f);
      results.push(...fetched);
    }
  }

  const newsletters = await fetchNewsletters();
  results.push(...newsletters);

  return {
    engine: "BHA Third Eye v2.2",
    timestamp: new Date().toISOString(),
    total_items: results.length,
    data: results,
  };
};

export async function processFeeds(input) {
  let feeds = [];
  if (input.feeds && Array.isArray(input.feeds) && input.feeds.length > 0) {
    feeds = input.feeds;
  } else if (input.url) {
    feeds = [input.url];
  } else {
    throw new Error("feeds must be a non-empty array or url must be provided");
  }

  const intel = await collectIntel(feeds);

  return {
    feed: {
      items: intel.data
    },
    total_items: intel.total_items,
    engine: intel.engine,
    timestamp: intel.timestamp
  };
}


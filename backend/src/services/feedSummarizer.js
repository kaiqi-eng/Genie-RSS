import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { timeouts } from "../config/index.js";

// Lazy-initialized LLM instance to avoid crash on module load
let llm = null;

/**
 * Get or create the LLM instance (lazy initialization)
 * Throws at runtime only when actually needed, not at module load
 */
function getLLM() {
  if (!llm) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    llm = new ChatOpenAI({
      model: "gpt-3.5-turbo-0125",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
      timeout: timeouts.llm,
    });
  }
  return llm;
}

/**
 * Build structured JSON-only prompt
 */
function buildPrompt(feeds) {
  return `
You are an intelligence analyst.

For EACH feed item:
- Generate a concise 3-4 line summary.

ALSO generate:
- Key themes (array)
- Important developments (array)
- Risks or opportunities (array)

Return ONLY valid JSON in the following format:

{
  "items": [
    {
      "title": "",
      "source": "",
      "published": "",
      "summary": ""
    }
  ]
}

Feeds:
${feeds.map((f, i) => `
${i + 1}.
Title: ${f.title}
Source: ${f.source || "unknown"}
Published: ${f.published || ""}
Content: ${(f.content || "").slice(0, 1500)}
`).join("\n")}
`;
}

export async function summarizeFeeds(feeds) {
  if (!Array.isArray(feeds) || feeds.length === 0) {
    throw new Error("feeds must be a non-empty array");
  }

  const prompt = buildPrompt(feeds);

  const llmInstance = getLLM();
  const response = await llmInstance.invoke([
    new HumanMessage(prompt),
  ]);

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (err) {
    throw new Error("LLM returned invalid JSON");
  }

  // Ensure parsed.items is an array, default to empty array if missing
  const parsedItems = Array.isArray(parsed.items) ? parsed.items : [];

  // Merge original feed content with AI summaries
  const items = feeds.map((feed, index) => ({
    title: feed.title,
    source: feed.source || "unknown",
    published: feed.published || "",
    content: feed.content || "",
    summary: parsedItems[index]?.summary || "No summary generated",
  }));

  return {
    total_feeds: feeds.length,
    items
  };
}

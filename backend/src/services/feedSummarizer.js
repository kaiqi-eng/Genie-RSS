import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing");
}

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-0125",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

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

  const response = await llm.invoke([
    new HumanMessage(prompt),
  ]);

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (err) {
    throw new Error("LLM returned invalid JSON");
  }

  // Merge original feed content with AI summaries
  const items = feeds.map((feed, index) => ({
    title: feed.title,
    source: feed.source || "unknown",
    published: feed.published || "",
    content: feed.content || "",
    summary: parsed.items?.[index]?.summary || "No summary generated",
  }));

  return {
    total_feeds: feeds.length,
    items
  };
}

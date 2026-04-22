import { Router, type IRouter } from "express";

const router: IRouter = Router();

type NewsItem = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  image?: string;
  description: string;
  section: "global" | "user-impact";
};

type GNewsArticle = {
  title?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
  image?: string;
  description?: string;
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractApiKey(raw: string): string {
  // Handle cases where the env var contains extra text like "here is the Gnews API : -abc123..."
  // Extract the last contiguous hex/alphanumeric token
  const match = raw.match(/[a-f0-9]{20,}/i);
  return match ? match[0] : raw.trim();
}

async function fetchGNews(query: string, max = 8): Promise<NewsItem[]> {
  const rawKey = process.env["GNEWS_API_KEY"];
  if (!rawKey) return [];
  const apiKey = extractApiKey(rawKey);

  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", String(max));
  url.searchParams.set("sortby", "publishedAt");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) return [];

  const data = (await response.json()) as {
    articles?: GNewsArticle[];
  };

  return (data.articles ?? [])
    .filter((article) => article.title && article.url)
    .map((article) => ({
      title: cleanText(article.title ?? ""),
      url: article.url ?? "",
      publishedAt: article.publishedAt ?? new Date().toISOString(),
      source: article.source?.name ?? "GNews",
      image: article.image,
      description: cleanText(article.description ?? ""),
      section: "global" as const,
    }));
}

function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    const key = cleanText(item.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

async function fetchCombinedNews(
  queries: string[],
  section: NewsItem["section"],
  limit: number,
): Promise<NewsItem[]> {
  const batches = await Promise.all(queries.map((query) => fetchGNews(query, 8)));
  return dedupeNews(
    batches
      .flat()
      .map((item) => ({ ...item, section }))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
  ).slice(0, limit);
}

async function fetchImpactNews(limit: number): Promise<NewsItem[]> {
  const primary = await fetchCombinedNews(
    [
      "(owner experience OR ownership review OR customer complaint) AND (car OR SUV OR EV)",
      "(fatal crash OR disastrous crash OR vehicle fire OR brake failure OR steering failure OR safety failure) AND (car OR SUV)",
      "\"5-star safety\" AND (crash OR complaint OR poor performance OR owner experience OR real world)",
      "(recall OR defect investigation) AND (airbag OR brake OR ADAS OR battery) AND (car OR SUV)",
    ],
    "user-impact",
    limit,
  );

  if (primary.length >= Math.min(3, limit)) {
    return primary;
  }

  const fallback = await fetchCombinedNews(
    [
      "(car recall OR vehicle recall OR safety recall) AND (car OR SUV OR EV)",
      "(owner complaint OR customer complaint OR defect) AND (car OR SUV)",
      "(car accident OR SUV accident OR EV fire OR battery fire) AND (owner OR driver OR family)",
      "(airbag failure OR brake failure OR steering issue OR sudden acceleration) AND (car OR SUV)",
    ],
    "user-impact",
    limit,
  );

  return dedupeNews([...primary, ...fallback]).slice(0, limit);
}

router.get("/news", async (_req, res): Promise<void> => {
  try {
    const [globalNews, userImpactNews] = await Promise.all([
      fetchCombinedNews(
        [
          "(automobile OR auto industry OR car market OR EV OR SUV OR sedan OR hatchback) AND (launch OR unveiled OR sales OR policy OR recall OR export)",
          "(electric vehicle OR EV OR battery OR charging OR hybrid) AND (automobile OR car)",
          "(automaker OR carmaker) AND (global sales OR production OR plant OR pricing OR regulation)",
        ],
        "global",
        6,
      ),
      fetchImpactNews(6),
    ]);

    res.json({
      updated_at: new Date().toISOString(),
      sections: {
        global: {
          title: "Global automotive world",
          description:
            "Launches, EV developments, regulations, pricing moves, production shifts, and other major changes across the automobile industry.",
          items: globalNews,
        },
        user_impact: {
          title: "Disastrous ownership experiences",
          description:
            "Serious owner-impact stories including fatal crashes, recalls, safety failures, defects, and cases where cars underperform in the real world despite strong safety claims.",
          items: userImpactNews,
        },
      },
    });
  } catch {
    res.status(502).json({
      error: "Unable to load news right now.",
    });
  }
});

export default router;

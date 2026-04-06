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
    articles?: Array<{
      title?: string;
      url?: string;
      publishedAt?: string;
      source?: { name?: string };
      image?: string;
      description?: string;
    }>;
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

router.get("/news", async (_req, res): Promise<void> => {
  try {
    const [globalNewsRaw, impactNewsRaw] = await Promise.all([
      fetchGNews("(automobile OR car OR EV OR SUV) India world", 10),
      fetchGNews(
        "(car crash OR fatal crash OR safety rating OR recall OR brake failure OR vehicle fire OR accident) India",
        10,
      ),
    ]);

    const globalNews = globalNewsRaw.slice(0, 6).map((item) => ({ ...item, section: "global" as const }));
    const userImpactNews = impactNewsRaw.slice(0, 6).map((item) => ({ ...item, section: "user-impact" as const }));

    res.json({
      updated_at: new Date().toISOString(),
      sections: {
        global: {
          title: "Global automotive updates",
          description: "News about electric vehicles, launches, policy changes, and market movements worldwide.",
          items: globalNews,
        },
        user_impact: {
          title: "User-impact stories",
          description: "Critical coverage of recalls, crashes, safety failures, and incidents affecting owners.",
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
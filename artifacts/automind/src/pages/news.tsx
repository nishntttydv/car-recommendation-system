import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

type NewsItem = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  image?: string;
  description: string;
  section: "global" | "user-impact";
};

async function fetchNews() {
  const response = await fetch("/api/news");
  if (!response.ok) {
    throw new Error("Failed to load car news");
  }
  return (await response.json()) as {
    updated_at: string;
    sections: {
      global: { title: string; description: string; items: NewsItem[] };
      user_impact: { title: string; description: string; items: NewsItem[] };
    };
  };
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="block">
      <div className="bg-card border border-border rounded-xl overflow-hidden h-full hover:border-primary/40 transition-colors">
        {item.image ? (
          <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
        ) : (
          <div className="h-44 bg-muted/30" />
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-wider text-primary font-bold">{item.source}</span>
            <span className="text-[11px] text-muted-foreground">{new Date(item.publishedAt).toLocaleDateString()}</span>
          </div>
          <h3 className="text-base font-bold text-foreground leading-snug">{item.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>
        </div>
      </div>
    </a>
  );
}

export default function News() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["news"],
    queryFn: fetchNews,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs text-primary font-medium">
            Latest car news
          </div>
          <h1 className="text-4xl font-black text-foreground">Car News</h1>
          <p className="text-muted-foreground max-w-3xl">
            Stay updated with the latest automobile industry developments, recalls, safety stories, and events that affect car owners.
          </p>
        </motion.div>

        <div className="grid gap-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">Global automotive updates</h2>
              <p className="text-muted-foreground">Industry launches, EV trends, policy changes, and market movement across the world.</p>
            </div>
            {isLoading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl h-80 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data?.sections.global.items.map((item) => (
                  <NewsCard key={item.url} item={item} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold">User-impact stories</h2>
              <p className="text-muted-foreground">Serious news about safety failures, crashes, recalls, and incidents that matter to owners.</p>
            </div>
            {isLoading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl h-80 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data?.sections.user_impact.items.map((item) => (
                  <NewsCard key={item.url} item={item} />
                ))}
              </div>
            )}
          </section>

          {isError && (
            <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
              News is temporarily unavailable. Please try again later.
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Updated live from GNews. <Link href="/insights" className="text-primary hover:underline">View market insights</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
import { motion } from "framer-motion";
import { useGetMarketOverview, useGetCarStats, getGetMarketOverviewQueryKey, getGetCarStatsQueryKey } from "@workspace/api-client-react";
import { CarCard } from "@/components/CarCard";

export default function Insights() {
  const { data: overview, isLoading } = useGetMarketOverview({
    query: { queryKey: getGetMarketOverviewQueryKey() },
  });

  const { data: stats } = useGetCarStats({
    query: { queryKey: getGetCarStatsQueryKey() },
  });

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs text-primary font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Market Intelligence
          </div>
          <h1 className="text-4xl font-black text-foreground">Smart Insights</h1>
          <p className="text-muted-foreground mt-2">Market overview, brand rankings, and budget analysis</p>
        </motion.div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Cars", value: stats.total_cars, suffix: "" },
              { label: "Brands", value: stats.total_brands, suffix: "" },
              { label: "Avg Price", value: `₹${stats.avg_price_lakh}L`, suffix: "" },
              { label: "Avg Mileage", value: `${stats.avg_mileage}`, suffix: "km/l" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="text-2xl font-black text-primary">{s.value}<span className="text-sm text-muted-foreground ml-1">{s.suffix}</span></div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl h-40 animate-pulse" />
            ))}
          </div>
        )}

        {overview && !isLoading && (
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Top Brands by Score</h2>
              <div className="space-y-3">
                {overview.top_brands.map((brand, i) => (
                  <div key={brand.brand} className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground w-4 text-right">{i + 1}</div>
                    <div className="w-24 text-sm font-medium text-foreground truncate">{brand.brand}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(brand.avg_score / 0.8) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                      />
                    </div>
                    <div className="text-xs text-primary font-bold w-12 text-right">{(brand.avg_score * 100).toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground w-12">{brand.count} cars</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Body Type Distribution</h2>
                <div className="space-y-3">
                  {overview.popular_body_types.map((bt, i) => {
                    const maxCount = overview.popular_body_types[0]?.count || 1;
                    return (
                      <div key={bt.body_type} className="flex items-center gap-3">
                        <div className="w-20 text-sm text-foreground">{bt.body_type}</div>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${(bt.count / maxCount) * 100}%` }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="h-full bg-secondary rounded-full"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground w-10 text-right">{bt.count}</div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Budget Segments</h2>
                <div className="space-y-3">
                  {overview.budget_segments.map((seg, i) => (
                    <div key={seg.segment} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <div className="text-sm font-medium text-foreground">{seg.segment}</div>
                        <div className="text-xs text-muted-foreground">{seg.range}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-primary">{seg.count}</div>
                        <div className="text-xs text-muted-foreground">cars</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {overview.best_value_cars?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Best Value Cars</h2>
                  <span className="bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full font-medium">Top Picks</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {overview.best_value_cars.slice(0, 5).map((car, i) => (
                    <CarCard key={car.car_id} car={car} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

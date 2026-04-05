import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCarStats, useGetCarBrands, useGetMarketOverview } from "@workspace/api-client-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();

  const { data: stats } = useGetCarStats();
  const { data: brandsData } = useGetCarBrands();
  const { data: marketOverview } = useGetMarketOverview();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-20">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs text-primary font-medium mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Smart Car Discovery Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight text-foreground leading-none mb-6"
          >
            Find Your
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-secondary">
              Perfect Car
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto"
          >
            Describe what you're looking for in plain English, Hindi, or Hinglish.
            Our system understands your needs and finds the best matches — even with typos.
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-6"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe your ideal car…"
                className="w-full bg-card/80 border border-border rounded-lg px-5 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-base"
              />
            </div>
            <motion.button
              type="submit"
              className="px-8 py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Smart Search
            </motion.button>
          </motion.form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {["SUV under 15 lakh", "fuel efficient diesel", "family MPV 7 seater", "Hyundai Creta", "electric car"].map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuery(ex);
                  navigate(`/search?q=${encodeURIComponent(ex)}`);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                {ex}
              </button>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <a
              href="/recommend"
              className="inline-flex items-center gap-2 text-secondary font-medium hover:text-secondary/80 transition-colors text-sm"
            >
              Explore Smart Recommendations
              <span>→</span>
            </a>
          </motion.div>
        </div>
      </section>

      {stats && (
        <section className="py-16 border-t border-border">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              {[
                { label: "Cars in Database", value: stats.total_cars, unit: "" },
                { label: "Brands", value: stats.total_brands, unit: "" },
                { label: "Avg Price", value: `₹${stats.avg_price_lakh}`, unit: "Lakh" },
                { label: "Avg Mileage", value: stats.avg_mileage, unit: "km/l" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-lg p-5 text-center"
                >
                  <div className="text-3xl font-black text-primary">
                    {stat.value}
                    <span className="text-base font-normal text-muted-foreground ml-1">{stat.unit}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {brandsData?.brands && (
        <section className="py-12 overflow-hidden border-t border-border">
          <div className="max-w-7xl mx-auto px-4 mb-8">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Featured Brands</h2>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-4 px-4 scrollbar-none">
            {brandsData.brands.map((brand) => (
              <motion.button
                key={brand}
                onClick={() => navigate(`/search?brand=${encodeURIComponent(brand)}`)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 bg-card border border-border rounded-lg px-5 py-3 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {brand}
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {marketOverview?.best_value_cars && (
        <section className="py-16 border-t border-border">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-8"
            >
              <h2 className="text-2xl font-black text-foreground">Top Value Cars</h2>
              <p className="text-muted-foreground text-sm mt-1">Highest-scoring cars across all categories</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {marketOverview.best_value_cars.slice(0, 5).map((car, i) => (
                <motion.a
                  key={car.car_id}
                  href={`/car/${car.car_id}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
                >
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{car.brand}</div>
                  <div className="font-bold text-foreground group-hover:text-primary transition-colors">{car.model}</div>
                  <div className="text-primary font-black text-lg">₹{car.price_lakh}L</div>
                  {car.score != null && (
                    <div className="text-xs text-secondary mt-1">Score {(car.score * 100).toFixed(0)}</div>
                  )}
                </motion.a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Typo Tolerant",
                description: "Type \"Hyndai\" and we'll still find Hyundai. Our smart search understands what you mean.",
                icon: "🔍",
              },
              {
                title: "Intelligent Scoring",
                description: "Every car is scored on price, mileage, safety, features, service cost, and brand perception.",
                icon: "📊",
              },
              {
                title: "Side-by-Side Compare",
                description: "Compare up to 4 cars at once across all specs, features, and spare part costs.",
                icon: "⚖",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-lg p-6"
              >
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

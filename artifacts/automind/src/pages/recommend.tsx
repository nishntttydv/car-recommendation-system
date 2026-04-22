import { useState } from "react";
import { motion } from "framer-motion";
import { useGetRecommendations } from "@workspace/api-client-react";
import { CarCard } from "@/components/CarCard";
import { trackProfileEvent } from "@/lib/profile-api";

const PRIORITIES = [
  { value: "mileage", label: "Best Mileage" },
  { value: "safety", label: "Safety First" },
  { value: "value", label: "Value for Money" },
  { value: "comfort", label: "Comfort & Features" },
];

export default function Recommend() {
  const [filters, setFilters] = useState<{
    budget_min?: number;
    budget_max?: number;
    fuel_type?: string;
    transmission?: string;
    body_type?: string;
    seating_capacity?: number;
    priority?: string;
  }>({});
  const [submitted, setSubmitted] = useState(false);

  const mutation = useGetRecommendations({
    mutation: {},
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    mutation.mutate({ data: filters });
  }

  const recommendations = mutation.data?.recommendations || [];

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs text-primary font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Intelligent Recommendations
          </div>
          <h1 className="text-4xl font-black text-foreground">Smart Recommendations</h1>
          <p className="text-muted-foreground mt-2">Tell us your preferences and we'll find the best matches</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card border border-border rounded-xl p-6 sticky top-20"
            >
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Your Preferences</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Min Budget (L)</label>
                    <input
                      type="number"
                      value={filters.budget_min || ""}
                      onChange={(e) => setFilters((p) => ({ ...p, budget_min: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="e.g. 5"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Max Budget (L)</label>
                    <input
                      type="number"
                      value={filters.budget_max || ""}
                      onChange={(e) => setFilters((p) => ({ ...p, budget_max: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="e.g. 15"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Fuel Type</label>
                  <select
                    value={filters.fuel_type || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, fuel_type: e.target.value || undefined }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  >
                    <option value="">Any</option>
                    {["Petrol", "Diesel", "Electric", "CNG"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Transmission</label>
                  <select
                    value={filters.transmission || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, transmission: e.target.value || undefined }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  >
                    <option value="">Any</option>
                    {["Manual", "Automatic"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Body Type</label>
                  <select
                    value={filters.body_type || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, body_type: e.target.value || undefined }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  >
                    <option value="">Any</option>
                    {["Hatchback", "Sedan", "SUV", "MPV"].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Min Seating</label>
                  <select
                    value={filters.seating_capacity || ""}
                    onChange={(e) => setFilters((p) => ({ ...p, seating_capacity: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  >
                    <option value="">Any</option>
                    {[4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>{n}+ Seats</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Priority</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, priority: prev.priority === p.value ? undefined : p.value }))}
                        className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                          filters.priority === p.value
                            ? "bg-primary/10 border-primary/50 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {mutation.isPending ? "Finding best cars..." : "Get Recommendations"}
                </motion.button>
              </form>
            </motion.div>
          </div>

          <div className="lg:col-span-2">
            {!submitted && !mutation.isPending && (
              <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
                <div className="text-center text-muted-foreground">
                  <div className="text-3xl mb-3 opacity-30">⭐</div>
                  <p className="text-sm">Fill in your preferences and get personalized recommendations</p>
                </div>
              </div>
            )}

            {mutation.isPending && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Finding your perfect cars...
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg h-48 animate-pulse" />
                ))}
              </div>
            )}

            {recommendations.length > 0 && !mutation.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Top {recommendations.length} Recommendations
                  </h2>
                  <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                    From {mutation.data?.total} matches
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recommendations.map((car, i) => (
                    <div key={car.car_id} className="relative">
                      {i === 0 && (
                        <div className="absolute -top-2 -right-2 z-10 bg-secondary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          Best Match
                        </div>
                      )}
                      <CarCard
                        car={car}
                        index={i}
                        onOpen={(openedCar) => {
                          trackProfileEvent({
                            event_type: "recommendation_clicked",
                            car_id: openedCar.car_id,
                            metadata: {
                              source: "recommend_page",
                              brand: openedCar.brand,
                              model: openedCar.model,
                            },
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {submitted && recommendations.length === 0 && !mutation.isPending && (
              <div className="text-center py-16">
                <div className="text-3xl mb-3 opacity-30">😕</div>
                <h3 className="font-bold text-foreground mb-2">No cars found</h3>
                <p className="text-muted-foreground text-sm">Try loosening your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

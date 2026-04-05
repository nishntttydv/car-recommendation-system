import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCars, getGetCarsQueryKey, useProcessQuery } from "@workspace/api-client-react";
import { CarCard } from "@/components/CarCard";
import { useQueryClient } from "@tanstack/react-query";

const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "CNG"];
const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "MPV"];
const TRANSMISSIONS = ["Manual", "Automatic"];

export default function Search() {
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const initialQuery = params.get("q") || "";
  const initialBrand = params.get("brand") || "";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [, navigate] = useLocation();

  const [filters, setFilters] = useState<{
    brand?: string;
    body_type?: string;
    fuel_type?: string;
    transmission?: string;
    max_price?: number;
    min_price?: number;
    search?: string;
  }>({
    brand: initialBrand || undefined,
    search: !initialBrand && !initialQuery ? undefined : undefined,
  });

  const processQuery = useProcessQuery({
    mutation: {
      onSuccess: (data) => {
        setCorrectedQuery(data.corrected_query !== initialQuery ? data.corrected_query : null);
        setFilters({
          brand: data.filters.brand || undefined,
          body_type: data.filters.body_type || undefined,
          fuel_type: data.filters.fuel_type || undefined,
          transmission: data.filters.transmission || undefined,
          max_price: data.filters.budget_max || undefined,
          min_price: data.filters.budget_min || undefined,
        });
      },
    },
  });

  useEffect(() => {
    if (initialQuery) {
      processQuery.mutate({ data: { query: initialQuery } });
    }
  }, [initialQuery]);

  const { data: carsData, isLoading } = useGetCars(filters, {
    query: { queryKey: getGetCarsQueryKey(filters) },
  });

  function handleCompareToggle(id: number) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function handleCompare() {
    if (compareIds.length >= 2) {
      navigate(`/compare?ids=${compareIds.join(",")}`);
    }
  }

  function handleFilterChange(key: string, value: string | undefined) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const cars = carsData?.cars || [];
  const total = carsData?.total || 0;

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          {initialQuery && (
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-lg font-bold text-foreground">
                {correctedQuery ? (
                  <>
                    Showing results for:{" "}
                    <span className="text-primary">{correctedQuery}</span>
                    <span className="text-xs text-muted-foreground ml-2">(corrected from "{initialQuery}")</span>
                  </>
                ) : (
                  <>Results for: <span className="text-primary">"{initialQuery}"</ span></>
                )}
              </h1>
            </div>
          )}
          {initialBrand && (
            <h1 className="text-lg font-bold text-foreground mb-2">
              All <span className="text-primary">{initialBrand}</span> cars
            </h1>
          )}
          <p className="text-sm text-muted-foreground">{total} cars found</p>
        </div>

        <div className="flex gap-6">
          <div className="hidden md:block w-56 flex-shrink-0">
            <div className="bg-card border border-border rounded-lg p-4 sticky top-20">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Filters</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Fuel Type</label>
                  <div className="space-y-1">
                    {FUEL_TYPES.map((f) => (
                      <label key={f} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="fuel"
                          checked={filters.fuel_type === f}
                          onChange={() => handleFilterChange("fuel_type", filters.fuel_type === f ? undefined : f)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Body Type</label>
                  <div className="space-y-1">
                    {BODY_TYPES.map((b) => (
                      <label key={b} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="body"
                          checked={filters.body_type === b}
                          onChange={() => handleFilterChange("body_type", filters.body_type === b ? undefined : b)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">{b}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Transmission</label>
                  <div className="space-y-1">
                    {TRANSMISSIONS.map((t) => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="transmission"
                          checked={filters.transmission === t}
                          onChange={() => handleFilterChange("transmission", filters.transmission === t ? undefined : t)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Max Budget (Lakh)</label>
                  <input
                    type="number"
                    value={filters.max_price || ""}
                    onChange={(e) => handleFilterChange("max_price", e.target.value || undefined)}
                    placeholder="e.g. 15"
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  />
                </div>

                <button
                  onClick={() => setFilters({})}
                  className="w-full text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1">
            {isLoading || processQuery.isPending ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg h-72 animate-pulse" />
                ))}
              </div>
            ) : cars.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4 opacity-20">🚗</div>
                <h3 className="text-lg font-bold text-foreground mb-2">No cars found</h3>
                <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cars.map((car, i) => (
                  <CarCard
                    key={car.car_id}
                    car={car}
                    index={i}
                    onCompareToggle={handleCompareToggle}
                    inCompare={compareIds.includes(car.car_id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {compareIds.length >= 2 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-card border border-primary/40 rounded-xl px-6 py-3 flex items-center gap-4 shadow-lg shadow-primary/10">
              <span className="text-sm text-foreground">
                <span className="text-primary font-bold">{compareIds.length}</span> cars selected
              </span>
              <motion.button
                onClick={handleCompare}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Compare Now
              </motion.button>
              <button
                onClick={() => setCompareIds([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

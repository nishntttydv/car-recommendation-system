import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCars, getGetCarsQueryKey, useProcessQuery } from "@workspace/api-client-react";
import { CarCard } from "@/components/CarCard";

const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"];
const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "MPV"];
const TRANSMISSIONS = ["Manual", "Automatic"];

const EXAMPLE_QUERIES = [
  "sunroo",
  "automatic SUV under 15 lakh",
  "hyndai creta",
  "family car 7 seater diesel",
  "electric car with touchscreen",
  "safe budget car under 8 lakh",
  "Toyota Fortuner",
];

type DisplayMode = "nlp" | "filter";

export default function Search() {
  const [location] = useLocation();
  const [, navigate] = useLocation();

  // Use window.location.search for reliable query param access (wouter location may omit search params)
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialQuery = params.get("q") || "";
  const initialBrand = params.get("brand") || "";

  const [localQuery, setLocalQuery] = useState(initialQuery);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialQuery ? "nlp" : "filter");
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const [sidebarFilters, setSidebarFilters] = useState<{
    brand?: string;
    body_type?: string;
    fuel_type?: string;
    transmission?: string;
    max_price?: number;
    min_price?: number;
  }>({
    brand: initialBrand || undefined,
  });

  // ---- NLP mode (query-process) ----
  const processQuery = useProcessQuery({
    mutation: {},
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qFromUrl = urlParams.get("q") || "";
    const brandFromUrl = urlParams.get("brand") || "";

    if (qFromUrl) {
      setLocalQuery(qFromUrl);
      setDisplayMode("nlp");
      processQuery.mutate({ data: { query: qFromUrl } });
    } else if (brandFromUrl) {
      setSidebarFilters((f) => ({ ...f, brand: brandFromUrl }));
      setDisplayMode("filter");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ---- Filter mode (useGetCars) ----
  const filterQueryParams = displayMode === "filter" ? sidebarFilters : {};
  const { data: carsData, isLoading: carsLoading } = useGetCars(filterQueryParams, {
    query: {
      queryKey: getGetCarsQueryKey(filterQueryParams),
      enabled: displayMode === "filter",
    },
  });

  // Unified car list
  const nlpCars = processQuery.data?.cars ?? [];
  const filterCars = carsData?.cars ?? [];
  const displayCars = displayMode === "nlp" ? nlpCars : filterCars;
  const displayTotal = displayMode === "nlp" ? (processQuery.data?.total ?? 0) : (carsData?.total ?? 0);
  const isLoading = displayMode === "nlp" ? processQuery.isPending : carsLoading;

  const correctedQuery = processQuery.data?.corrected_query;
  const showCorrected = correctedQuery && correctedQuery.toLowerCase() !== initialQuery.toLowerCase();
  const intentText = processQuery.data?.intent;

  const filtersApplied = processQuery.data?.filters
    ? Object.entries(processQuery.data.filters).filter(([, v]) => v != null)
    : [];

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (localQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
      setDisplayMode("nlp");
      processQuery.mutate({ data: { query: localQuery.trim() } });
    }
  }

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

  function handleFilterChange(key: string, value: string | number | undefined) {
    setDisplayMode("filter");
    setSidebarFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      {/* Search bar */}
      <div className="border-b border-border bg-background/80 backdrop-blur sticky top-16 z-40 py-3">
        <div className="max-w-7xl mx-auto px-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Try: sunroo, automatic under 15 lakh, hyndai creta, 7 seater family car…"
                className="w-full bg-card border border-border rounded-lg pl-4 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
              />
              {localQuery && (
                <button
                  type="button"
                  onClick={() => { setLocalQuery(""); setSidebarFilters({}); setDisplayMode("filter"); navigate("/search"); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <motion.button
              type="submit"
              className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Search
            </motion.button>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Smart query feedback */}
        <AnimatePresence>
          {displayMode === "nlp" && (processQuery.data || processQuery.isPending) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-5 bg-card border border-border rounded-lg p-4"
            >
              {processQuery.isPending ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">Understanding your search…</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {showCorrected && (
                      <div className="text-xs text-muted-foreground mb-1">
                        Showing results for:{" "}
                        <span className="text-primary font-medium">{correctedQuery}</span>
                        <span className="text-muted-foreground ml-1">(corrected from "{initialQuery}")</span>
                      </div>
                    )}
                    {intentText && (
                      <div className="text-xs text-muted-foreground">{intentText}</div>
                    )}
                    {filtersApplied.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {filtersApplied.map(([key, val]) => (
                          <span key={key} className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                            {key.replace(/_/g, " ")}: {String(val)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black text-primary">{displayTotal}</div>
                    <div className="text-xs text-muted-foreground">cars found</div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial browse state */}
        {!initialQuery && !initialBrand && displayMode === "filter" && !Object.values(sidebarFilters).some(Boolean) && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Try searching for</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setLocalQuery(ex);
                    navigate(`/search?q=${encodeURIComponent(ex)}`);
                    setDisplayMode("nlp");
                    processQuery.mutate({ data: { query: ex } });
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="hidden md:block w-52 flex-shrink-0">
            <div className="bg-card border border-border rounded-lg p-4 sticky top-32">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filters</h3>
                {displayMode === "filter" && Object.values(sidebarFilters).some(Boolean) && (
                  <button
                    onClick={() => { setSidebarFilters({}); navigate("/search"); }}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Fuel Type</label>
                  {FUEL_TYPES.map((f) => (
                    <label key={f} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="radio"
                        name="fuel"
                        checked={sidebarFilters.fuel_type === f}
                        onChange={() => handleFilterChange("fuel_type", sidebarFilters.fuel_type === f ? undefined : f)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{f}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Body Type</label>
                  {BODY_TYPES.map((b) => (
                    <label key={b} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="radio"
                        name="body"
                        checked={sidebarFilters.body_type === b}
                        onChange={() => handleFilterChange("body_type", sidebarFilters.body_type === b ? undefined : b)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{b}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Transmission</label>
                  {TRANSMISSIONS.map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="radio"
                        name="transmission"
                        checked={sidebarFilters.transmission === t}
                        onChange={() => handleFilterChange("transmission", sidebarFilters.transmission === t ? undefined : t)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{t}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Max Budget (Lakh)</label>
                  <input
                    type="number"
                    value={sidebarFilters.max_price || ""}
                    onChange={(e) => handleFilterChange("max_price", e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 20"
                    className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results grid */}
          <div className="flex-1 min-w-0">
            {!isLoading && displayMode === "filter" && !Object.values(sidebarFilters).some(Boolean) && !initialBrand && (
              <div className="text-xs text-muted-foreground mb-4">
                {carsData?.total ?? 0} cars available — use filters or type above to narrow down
              </div>
            )}
            {displayMode === "filter" && initialBrand && !isLoading && (
              <div className="text-sm font-medium text-foreground mb-4">
                {carsData?.total ?? 0} cars from <span className="text-primary">{initialBrand}</span>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg h-72 animate-pulse" />
                ))}
              </div>
            ) : displayCars.length === 0 && (initialQuery || Object.values(sidebarFilters).some(Boolean) || initialBrand) ? (
              <div className="text-center py-20 border border-dashed border-border rounded-xl">
                <div className="text-4xl mb-4 opacity-20">🔍</div>
                <h3 className="text-lg font-bold text-foreground mb-2">No cars found</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {initialQuery
                    ? `No matches for "${initialQuery}". Try a different search.`
                    : "Try adjusting your filters."}
                </p>
                <button
                  onClick={() => { setSidebarFilters({}); setLocalQuery(""); navigate("/search"); }}
                  className="text-primary text-sm hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : displayCars.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg h-72 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayCars.map((car, i) => (
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

      {/* Compare bar */}
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

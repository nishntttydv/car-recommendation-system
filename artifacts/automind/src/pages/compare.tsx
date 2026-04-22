import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useCompareCars, useGetCars, getGetCarsQueryKey } from "@workspace/api-client-react";
import { trackProfileEvent } from "@/lib/profile-api";

export default function Compare() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const initialIds = params.get("ids")?.split(",").map(Number).filter(Boolean) || [];

  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [compareResult, setCompareResult] = useState<ReturnType<typeof useCompareCars>["data"]>();

  const { data: searchResults } = useGetCars(
    searchQuery ? { search: searchQuery, limit: 8 } : {},
    {
      query: {
        queryKey: getGetCarsQueryKey(searchQuery ? { search: searchQuery, limit: 8 } : {}),
        enabled: !!searchQuery,
      },
    }
  );

  const mutation = useCompareCars({
    mutation: {
      onSuccess: (data) => {
        setCompareResult(data);
      },
    },
  });

  useEffect(() => {
    if (initialIds.length >= 2) {
      mutation.mutate({ data: { car_ids: initialIds } });
    }
  }, []);

  function handleCompare() {
    if (selectedIds.length >= 2) {
      trackProfileEvent({ event_type: "compare_started", metadata: { car_ids: selectedIds, source: "compare_page" } });
      mutation.mutate({ data: { car_ids: selectedIds } });
    }
  }

  function removeId(id: number) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setCompareResult(undefined);
  }

  function addCar(id: number) {
    if (!selectedIds.includes(id) && selectedIds.length < 4) {
      trackProfileEvent({ event_type: "compare_candidate_added", car_id: id, metadata: { source: "compare_search" } });
      setSelectedIds((prev) => [...prev, id]);
      setSearchQuery("");
    }
  }

  const cars = compareResult?.cars || [];
  const winner = compareResult?.winner;

  const specs = [
    { key: "price_lakh", label: "Price", format: (v: unknown) => `₹${v}L` },
    { key: "mileage_kmpl", label: "Mileage", format: (v: unknown) => v === 0 ? "Electric" : `${v} km/l` },
    { key: "engine_cc", label: "Engine", format: (v: unknown) => v === 0 ? "Electric" : `${v} CC` },
    { key: "fuel_type", label: "Fuel Type", format: (v: unknown) => String(v) },
    { key: "transmission", label: "Transmission", format: (v: unknown) => String(v) },
    { key: "seating_capacity", label: "Seating", format: (v: unknown) => `${v} Seats` },
    { key: "airbags", label: "Airbags", format: (v: unknown) => `${v} Bags` },
    { key: "safety_rating", label: "Safety Rating", format: (v: unknown) => `${v}/5` },
    { key: "service_cost_inr", label: "Service Cost", format: (v: unknown) => `₹${(v as number)?.toLocaleString()}` },
    { key: "sentiment_score", label: "Sentiment", format: (v: unknown) => `${((v as number) * 100).toFixed(0)}%` },
    { key: "brand_image_score", label: "Brand Score", format: (v: unknown) => `${v}/10` },
    { key: "abs", label: "ABS", format: (v: unknown) => String(v) },
    { key: "sunroof", label: "Sunroof", format: (v: unknown) => String(v) },
    { key: "touchscreen", label: "Touchscreen", format: (v: unknown) => String(v) },
    { key: "cruise_control", label: "Cruise Control", format: (v: unknown) => String(v) },
    { key: "score", label: "Overall Score", format: (v: unknown) => `${((v as number) * 100).toFixed(0)}/100` },
  ];

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
            Side-by-Side Analysis
          </div>
          <h1 className="text-4xl font-black text-foreground">Compare Cars</h1>
          <p className="text-muted-foreground mt-2">Select 2-4 cars to compare side by side</p>
        </motion.div>

        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex flex-wrap gap-3 mb-4">
            {selectedIds.map((id) => {
              const car = cars.find((c) => c.car_id === id);
              return (
                <div key={id} className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-primary font-medium">{car ? `${car.brand} ${car.model}` : `Car #${id}`}</span>
                  <button onClick={() => removeId(id)} className="text-muted-foreground hover:text-destructive text-xs ml-1">✕</button>
                </div>
              );
            })}
            {selectedIds.length < 4 && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search car to add..."
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/60 w-48"
                />
                {searchResults?.cars && searchResults.cars.length > 0 && searchQuery && (
                  <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {searchResults.cars.map((c) => (
                      <button
                        key={c.car_id}
                        onClick={() => addCar(c.car_id)}
                        disabled={selectedIds.includes(c.car_id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors disabled:opacity-40"
                      >
                        <span className="font-medium text-foreground">{c.brand} {c.model}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{c.variant_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <motion.button
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || mutation.isPending}
            className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 text-sm"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {mutation.isPending ? "Comparing..." : `Compare ${selectedIds.length} Cars`}
          </motion.button>
        </div>

        {mutation.isPending && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Analyzing cars...</p>
          </div>
        )}

        {cars.length >= 2 && !mutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {winner && (
              <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-secondary text-sm">★</span>
                  </div>
                  <div>
                    <div className="text-xs text-secondary uppercase tracking-wider font-bold mb-0.5">Winner</div>
                    <p className="text-sm text-foreground">{winner.reason}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs text-muted-foreground uppercase tracking-wider py-3 pr-4 font-medium w-32">Spec</th>
                    {cars.map((car) => (
                      <th key={car.car_id} className={`text-center py-3 px-4 ${winner?.car_id === car.car_id ? "border-t-2 border-secondary" : ""}`}>
                        <div className="mb-3">
                          <div className="relative h-40 rounded-xl overflow-hidden bg-gradient-to-br from-[hsl(220,20%,8%)] to-[hsl(220,20%,12%)] border border-border">
                            {car.image_url ? (
                              <img
                                src={car.image_url}
                                alt={`${car.brand} ${car.model}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                }}
                              />
                            ) : null}
                            <div className={`${car.image_url ? "hidden" : ""} absolute inset-0 flex items-center justify-center`}>
                              <span className="text-3xl font-black text-primary/20">{car.brand.slice(0, 2).toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{car.brand}</div>
                        <div className={`font-bold text-sm ${winner?.car_id === car.car_id ? "text-secondary" : "text-foreground"}`}>{car.model}</div>
                        <div className="text-xs text-muted-foreground">{car.variant_name}</div>
                        {winner?.car_id === car.car_id && (
                          <div className="text-xs font-bold text-secondary mt-1">★ Best Overall</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {specs.map((spec, si) => (
                    <tr key={spec.key} className={`${si % 2 === 0 ? "bg-card/30" : ""}`}>
                      <td className="text-xs text-muted-foreground py-2.5 pr-4 font-medium">{spec.label}</td>
                      {cars.map((car) => {
                        const val = (car as Record<string, unknown>)[spec.key];
                        const isWinner = winner?.car_id === car.car_id;
                        return (
                          <td key={car.car_id} className={`text-center py-2.5 px-4 text-sm ${isWinner ? "text-secondary font-medium" : "text-foreground"}`}>
                            {spec.format(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {selectedIds.length < 2 && !mutation.isPending && !compareResult && (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <div className="text-4xl mb-4 opacity-20">⚖</div>
            <h3 className="font-bold text-foreground mb-2">Add cars to compare</h3>
            <p className="text-muted-foreground text-sm">Select 2-4 cars from the search box above</p>
          </div>
        )}
      </div>
    </div>
  );
}

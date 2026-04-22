import { useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetCarById, useGetCarInsights, getGetCarByIdQueryKey, getGetCarInsightsQueryKey } from "@workspace/api-client-react";
import { trackProfileEvent } from "@/lib/profile-api";

export default function CarDetail() {
  const [, params] = useRoute("/car/:carId");
  const carId = parseInt(params?.carId || "0", 10);
  const [, navigate] = useLocation();
  const viewStartRef = useRef<number | null>(null);

  const { data: car, isLoading } = useGetCarById(carId, {
    query: { queryKey: getGetCarByIdQueryKey(carId), enabled: !!carId },
  });

  const { data: insights, isLoading: insightsLoading } = useGetCarInsights(carId, {
    query: { queryKey: getGetCarInsightsQueryKey(carId), enabled: !!carId },
  });

  useEffect(() => {
    if (!car) return;
    viewStartRef.current = Date.now();
    trackProfileEvent({
      event_type: "car_viewed",
      car_id: car.car_id,
      metadata: { brand: car.brand, model: car.model, source: "car_detail" },
    });

    return () => {
      if (!viewStartRef.current) return;
      const durationMs = Date.now() - viewStartRef.current;
      if (durationMs < 3000) return;
      trackProfileEvent({
        event_type: "car_detail_time_spent",
        car_id: car.car_id,
        metadata: {
          source: "car_detail",
          duration_ms: durationMs,
          brand: car.brand,
          model: car.model,
        },
      });
    };
  }, [car]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading car details...</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Car not found</h2>
          <button onClick={() => navigate("/")} className="text-primary text-sm hover:underline">
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const features = [
    { label: "ABS", value: car.abs },
    { label: "Rear Camera", value: car.rear_camera },
    { label: "Touchscreen", value: car.touchscreen },
    { label: "Cruise Control", value: car.cruise_control },
    { label: "Sunroof", value: car.sunroof },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1 as unknown as string)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors mb-6 flex items-center gap-1"
        >
          ← Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="bg-card border border-border rounded-xl overflow-hidden h-64 relative">
              {car.image_url ? (
                <img
                  src={car.image_url}
                  alt={`${car.brand} ${car.model}`}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-8xl font-black text-primary/10">{car.brand.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <span className="bg-primary/90 text-white text-xs font-bold px-3 py-1 rounded-full">{car.fuel_type}</span>
                <span className="bg-card/90 border border-border text-foreground text-xs font-medium px-3 py-1 rounded-full">{car.body_type}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{car.brand}</div>
            <h1 className="text-4xl font-black text-foreground mb-1">
              {car.model}
            </h1>
            <p className="text-muted-foreground mb-4">{car.variant_name}</p>

            <div className="text-5xl font-black text-primary mb-6">
              ₹{car.price_lakh}
              <span className="text-base font-normal text-muted-foreground ml-2">Lakh</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Mileage", value: car.mileage_kmpl > 0 ? `${car.mileage_kmpl} km/l` : "Electric" },
                { label: "Engine", value: car.engine_cc > 0 ? `${car.engine_cc} CC` : "Electric" },
                { label: "Transmission", value: car.transmission },
                { label: "Seating", value: `${car.seating_capacity} Seats` },
                { label: "Safety Rating", value: `${car.safety_rating}/5 Stars` },
                { label: "Year", value: car.year },
              ].map((spec) => (
                <div key={spec.label} className="bg-background border border-border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-0.5">{spec.label}</div>
                  <div className="font-bold text-foreground text-sm">{spec.value}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <div className="flex-1 bg-card border border-border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Brand Perception</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(car.brand_image_score / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-primary">{car.brand_image_score}/10</span>
                </div>
              </div>
              <div className="flex-1 bg-card border border-border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Sentiment Score</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full"
                      style={{ width: `${car.sentiment_score * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-secondary">{(car.sentiment_score * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Features</h2>
            <div className="space-y-2">
              {features.map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{f.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${f.value === "Yes" ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {f.value}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Airbags</span>
                <span className="text-xs font-bold text-primary">{car.airbags} bags</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Service Cost</h2>
            <div className="text-3xl font-black text-secondary mb-1">₹{car.service_cost_inr?.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Annual estimated service cost</div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Spare Parts</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: "Headlight", value: car.headlight_inr },
                { label: "Backlight", value: car.backlight_inr },
                { label: "Front Bumper", value: car.front_bumper_inr },
                { label: "Rear Bumper", value: car.rear_bumper_inr },
                { label: "Side Mirror", value: car.side_mirror_inr },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-medium text-foreground">₹{(p.value || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {insightsLoading && (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </div>
          </div>
        )}

        {insights && !insightsLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-primary text-xs">✦</span>
              </div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Smart Insights</h2>
            </div>

            <p className="text-foreground text-sm leading-relaxed mb-6">{insights.why_recommended}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-xs text-green-400 uppercase tracking-wider mb-2 font-bold">Strengths</h3>
                <ul className="space-y-1">
                  {insights.strengths.map((s) => (
                    <li key={s} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs text-destructive uppercase tracking-wider mb-2 font-bold">Weaknesses</h3>
                <ul className="space-y-1">
                  {insights.weaknesses.map((w) => (
                    <li key={w} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-destructive mt-0.5">-</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Best For</div>
                <p className="text-sm text-foreground">{insights.best_for}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">Value Score</div>
                <div className="text-2xl font-black text-primary">{insights.value_score}<span className="text-sm text-muted-foreground">/10</span></div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

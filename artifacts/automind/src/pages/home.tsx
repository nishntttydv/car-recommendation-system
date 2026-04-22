import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCarStats, useGetCarBrands, useGetMarketOverview } from "@workspace/api-client-react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { useAuth } from "@/contexts/AuthContext";
import { CarCard } from "@/components/CarCard";
import { fetchPersonalizedRecommendations, fetchProfile, saveOnboardingProfile, toggleFavorite, trackProfileEvent, type ContextualRow, type PersonalizedCar, type UserProfileRecord } from "@/lib/profile-api";

export default function Home() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [personalizedCars, setPersonalizedCars] = useState<PersonalizedCar[]>([]);
  const [contextualRows, setContextualRows] = useState<ContextualRow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [onboarding, setOnboarding] = useState({
    budget_min: "",
    budget_max: "",
    household_size: "5",
    primary_use: "family",
    preferred_body_types: [] as string[],
    preferred_fuel_types: [] as string[],
    preferred_transmissions: [] as string[],
    preferred_brands: [] as string[],
  });

  const { data: stats } = useGetCarStats();
  const { data: brandsData } = useGetCarBrands();
  const { data: marketOverview } = useGetMarketOverview();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      trackProfileEvent({ event_type: "search_submitted", query_text: query.trim(), metadata: { source: "home" } });
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const { isListening, voiceSupported, voiceMessage, toggleVoiceSearch } = useVoiceSearch({
    value: query,
    silenceMs: 2500,
    onTranscript: setQuery,
    onAutoSubmit: (spokenQuery) => {
      setQuery(spokenQuery);
      trackProfileEvent({ event_type: "search_submitted", query_text: spokenQuery, metadata: { source: "home_voice" } });
      navigate(`/search?q=${encodeURIComponent(spokenQuery)}`);
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      setPersonalizedCars([]);
      return;
    }

    setProfileLoading(true);
    setProfileError("");

    Promise.all([fetchProfile(), fetchPersonalizedRecommendations()])
      .then(([profileResponse, recommendationsResponse]) => {
        setProfile(profileResponse.profile);
        setPersonalizedCars(recommendationsResponse.recommendations ?? []);
        setContextualRows(recommendationsResponse.contextual_rows ?? []);
        setFavoriteIds((profileResponse.favorites ?? []).map((item) => item.carId));
      })
      .catch(() => {
        setProfileError("We couldn't load your personalized space right now.");
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [isAuthenticated]);

  function toggleChoice(key: "preferred_body_types" | "preferred_fuel_types" | "preferred_transmissions" | "preferred_brands", value: string) {
    setOnboarding((prev) => {
      const exists = prev[key].includes(value);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((item) => item !== value) : [...prev[key], value],
      };
    });
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError("");

    try {
      const result = await saveOnboardingProfile({
        budget_min: onboarding.budget_min ? Number(onboarding.budget_min) : undefined,
        budget_max: onboarding.budget_max ? Number(onboarding.budget_max) : undefined,
        household_size: onboarding.household_size ? Number(onboarding.household_size) : undefined,
        primary_use: onboarding.primary_use,
        preferred_body_types: onboarding.preferred_body_types,
        preferred_fuel_types: onboarding.preferred_fuel_types,
        preferred_transmissions: onboarding.preferred_transmissions,
        preferred_brands: onboarding.preferred_brands,
      });

      setProfile(result.profile);
      const recommendationsResponse = await fetchPersonalizedRecommendations();
      setPersonalizedCars(recommendationsResponse.recommendations ?? []);
      setContextualRows(recommendationsResponse.contextual_rows ?? []);
    } catch {
      setProfileError("We couldn't save your preferences. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleFavoriteToggle(carId: number) {
    try {
      const result = await toggleFavorite(carId);
      setFavoriteIds((prev) => result.favorite ? [...new Set([...prev, carId])] : prev.filter((id) => id !== carId));
      const refreshed = await fetchPersonalizedRecommendations();
      setPersonalizedCars(refreshed.recommendations ?? []);
      setContextualRows(refreshed.contextual_rows ?? []);
    } catch {
      setProfileError("We couldn't update your wishlist right now.");
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
            Discover the right car faster with natural-language search, intelligent
            recommendations, and results that understand real buying intent.
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
                placeholder="Search by need, budget, brand, or driving style"
                className="w-full bg-card/80 border border-border rounded-lg pl-5 pr-16 py-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-base"
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                    isListening
                      ? "border-primary bg-primary text-white"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                  }`}
                  aria-label={isListening ? "Stop voice search" : "Start voice search"}
                  title={isListening ? "Stop voice search" : "Start voice search"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>
            <motion.button
              type="submit"
              className="px-8 py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Search Cars
            </motion.button>
          </motion.form>
          {(voiceSupported || voiceMessage) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground mb-6"
            >
              {voiceMessage || "Tap the mic and speak naturally. After a short pause, we'll search automatically."}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {[
              "SUV under 20 lakh",
              "comfortable family car",
              "automatic city car",
              "7 seater for highway trips",
              "best EV for daily commute",
              "safe car under 15 lakh",
            ].map((ex) => (
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
              Explore Recommendations
              <span>→</span>
            </a>
          </motion.div>
        </div>
      </section>

      {isAuthenticated && (
        <section className="py-10 border-t border-border">
          <div className="max-w-7xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="text-xs text-primary uppercase tracking-[0.22em] font-bold mb-2">Personalized Experience</div>
                  <h2 className="text-2xl font-black text-foreground">
                    {user ? `${user.name.split(" ")[0]}, let’s make AutoMind yours` : "Let’s personalize AutoMind"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    We learn from your searches, car views, and browsing patterns to recommend better cars every time you come back.
                  </p>
                </div>
                {profile && (
                  <div className="grid grid-cols-2 gap-3 text-sm min-w-[240px]">
                    <div className="bg-background border border-border rounded-xl p-3">
                      <div className="text-xs text-muted-foreground mb-1">Profile Stage</div>
                      <div className="font-bold text-foreground capitalize">{profile.profileStage}</div>
                    </div>
                    <div className="bg-background border border-border rounded-xl p-3">
                      <div className="text-xs text-muted-foreground mb-1">Onboarding</div>
                      <div className="font-bold text-foreground">{profile.onboardingCompleted ? "Complete" : "Pending"}</div>
                    </div>
                  </div>
                )}
              </div>

              {!profileLoading && profile && !profile.onboardingCompleted && (
                <form onSubmit={handleSaveProfile} className="mt-6 border-t border-border pt-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-foreground">Set Your Preferences</h3>
                    <p className="text-xs text-muted-foreground mt-1">Share a few preferences to get better recommendations from the start. Your activity will keep improving them over time.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Min Budget (Lakh)</label>
                      <input
                        value={onboarding.budget_min}
                        onChange={(e) => setOnboarding((prev) => ({ ...prev, budget_min: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                        placeholder="e.g. 8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Max Budget (Lakh)</label>
                      <input
                        value={onboarding.budget_max}
                        onChange={(e) => setOnboarding((prev) => ({ ...prev, budget_max: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                        placeholder="e.g. 20"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Household Size</label>
                      <select
                        value={onboarding.household_size}
                        onChange={(e) => setOnboarding((prev) => ({ ...prev, household_size: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                      >
                        {[4, 5, 6, 7].map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Primary Use</label>
                      <select
                        value={onboarding.primary_use}
                        onChange={(e) => setOnboarding((prev) => ({ ...prev, primary_use: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60"
                      >
                        {[
                          { value: "family", label: "Family" },
                          { value: "city", label: "City" },
                          { value: "highway", label: "Highway" },
                          { value: "fun", label: "Fun to Drive" },
                        ].map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Body Types</div>
                      <div className="flex flex-wrap gap-2">
                        {["Hatchback", "Sedan", "SUV", "MPV"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleChoice("preferred_body_types", item)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              onboarding.preferred_body_types.includes(item)
                                ? "bg-primary/10 border-primary/50 text-primary"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Fuel Types</div>
                      <div className="flex flex-wrap gap-2">
                        {["Petrol", "Diesel", "Electric", "Hybrid", "CNG"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleChoice("preferred_fuel_types", item)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              onboarding.preferred_fuel_types.includes(item)
                                ? "bg-primary/10 border-primary/50 text-primary"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Transmission</div>
                      <div className="flex flex-wrap gap-2">
                        {["Manual", "Automatic"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleChoice("preferred_transmissions", item)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              onboarding.preferred_transmissions.includes(item)
                                ? "bg-primary/10 border-primary/50 text-primary"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Preferred Brands</div>
                      <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-2">
                        {(brandsData?.brands ?? []).slice(0, 14).map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleChoice("preferred_brands", item)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                              onboarding.preferred_brands.includes(item)
                                ? "bg-primary/10 border-primary/50 text-primary"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {profileError && (
                    <div className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                      {profileError}
                    </div>
                  )}

                  <div className="mt-5">
                    <motion.button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {savingProfile ? "Saving your preferences..." : "Start Personalizing"}
                    </motion.button>
                  </div>
                </form>
              )}

              {!profileLoading && profile?.onboardingCompleted && personalizedCars.length > 0 && (
                <div className="mt-6 border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Recommended For You</h3>
                      <p className="text-xs text-muted-foreground mt-1">Powered by your saved preferences and recent interactions.</p>
                    </div>
                    <a href="/recommend" className="text-xs text-primary hover:text-primary/80">Open full recommendations</a>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {personalizedCars.slice(0, 4).map((car, index) => (
                      <div key={car.car_id}>
                        <CarCard
                          car={car}
                          index={index}
                          onOpen={(openedCar) => {
                            trackProfileEvent({
                              event_type: "recommendation_clicked",
                              car_id: openedCar.car_id,
                              metadata: {
                                source: "home_personalized",
                                brand: openedCar.brand,
                                model: openedCar.model,
                              },
                            });
                          }}
                          onFavoriteToggle={handleFavoriteToggle}
                          isFavorite={favoriteIds.includes(car.car_id)}
                        />
                        {car.recommendation_reason && (
                          <div className="mt-2 text-xs text-muted-foreground px-1">{car.recommendation_reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profileLoading && (
                <div className="mt-6 text-sm text-muted-foreground">Preparing your personalized recommendations...</div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {isAuthenticated && contextualRows.length > 0 && (
        <section className="py-8 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 space-y-8">
            {contextualRows.map((row) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{row.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{row.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {row.cars.slice(0, 3).map((car, index) => (
                    <CarCard
                      key={car.car_id}
                      car={car}
                      index={index}
                      onOpen={(openedCar) => {
                        trackProfileEvent({
                          event_type: "recommendation_clicked",
                          car_id: openedCar.car_id,
                          metadata: { source: row.id, brand: openedCar.brand, model: openedCar.model },
                        });
                      }}
                      onFavoriteToggle={handleFavoriteToggle}
                      isFavorite={favoriteIds.includes(car.car_id)}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

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
                { label: "Body Styles", value: Object.keys(stats.body_type_counts ?? {}).length, unit: "" },
                { label: "Fuel Options", value: Object.keys(stats.fuel_type_counts ?? {}).length, unit: "" },
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
              <p className="text-muted-foreground text-sm mt-1">Standout picks selected for overall value, ownership appeal, and everyday usability</p>
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
                description: "Search naturally, even with spelling mistakes, mixed language, or incomplete model names.",
                icon: "🔍",
              },
              {
                title: "Intelligent Scoring",
                description: "Every recommendation blends pricing, efficiency, safety, features, ownership cost, and market perception.",
                icon: "📊",
              },
              {
                title: "Side-by-Side Compare",
                description: "Compare multiple cars in one view across specifications, features, and ownership considerations.",
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

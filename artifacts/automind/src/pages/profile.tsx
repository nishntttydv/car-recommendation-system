import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPersonalizedRecommendations, fetchProfile, saveOnboardingProfile, toggleFavorite, type FavoriteRecord, type PersonalizedCar, type UserProfileRecord } from "@/lib/profile-api";
import { CarCard } from "@/components/CarCard";
import { trackProfileEvent } from "@/lib/profile-api";

type ProfileResponse = Awaited<ReturnType<typeof fetchProfile>>;

const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "MPV"];
const FUEL_TYPES = ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"];
const TRANSMISSIONS = ["Manual", "Automatic"];

export default function ProfilePage() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [recommendations, setRecommendations] = useState<PersonalizedCar[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    budget_min: "",
    budget_max: "",
    household_size: "5",
    primary_use: "family",
    preferred_body_types: [] as string[],
    preferred_fuel_types: [] as string[],
    preferred_transmissions: [] as string[],
    preferred_brands: [] as string[],
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [profileResponse, recommendationResponse] = await Promise.all([
          fetchProfile(),
          fetchPersonalizedRecommendations(),
        ]);

        setProfileData(profileResponse);
        setRecommendations(recommendationResponse.recommendations ?? []);
        setFavorites(profileResponse.favorites ?? []);

        const profile = profileResponse.profile;
        setForm({
          budget_min: profile.budgetMin != null ? String(profile.budgetMin) : "",
          budget_max: profile.budgetMax != null ? String(profile.budgetMax) : "",
          household_size: profile.householdSize != null ? String(profile.householdSize) : "5",
          primary_use: profile.primaryUse ?? "family",
          preferred_body_types: profile.preferredBodyTypes ?? [],
          preferred_fuel_types: profile.preferredFuelTypes ?? [],
          preferred_transmissions: profile.preferredTransmissions ?? [],
          preferred_brands: profile.preferredBrands ?? [],
        });
      } catch {
        setError("We couldn't load your profile right now.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, navigate]);

  function toggleChoice(key: "preferred_body_types" | "preferred_fuel_types" | "preferred_transmissions", value: string) {
    setForm((prev) => {
      const exists = prev[key].includes(value);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((item) => item !== value) : [...prev[key], value],
      };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveOnboardingProfile({
        budget_min: form.budget_min ? Number(form.budget_min) : undefined,
        budget_max: form.budget_max ? Number(form.budget_max) : undefined,
        household_size: form.household_size ? Number(form.household_size) : undefined,
        primary_use: form.primary_use,
        preferred_body_types: form.preferred_body_types,
        preferred_fuel_types: form.preferred_fuel_types,
        preferred_transmissions: form.preferred_transmissions,
        preferred_brands: profileData?.profile.preferredBrands ?? [],
      });

      const [profileResponse, recommendationResponse] = await Promise.all([
        fetchProfile(),
        fetchPersonalizedRecommendations(),
      ]);
      setProfileData(profileResponse);
      setRecommendations(recommendationResponse.recommendations ?? []);
      setFavorites(profileResponse.favorites ?? []);
    } catch {
      setError("We couldn't save your profile changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFavoriteToggle(carId: number) {
    try {
      const result = await toggleFavorite(carId);
      setFavorites((prev) => result.favorite
        ? [...prev, { id: Date.now(), userId: user?.id ?? 0, carId, createdAt: new Date().toISOString() }]
        : prev.filter((item) => item.carId !== carId));
      const recommendationResponse = await fetchPersonalizedRecommendations();
      setRecommendations(recommendationResponse.recommendations ?? []);
    } catch {
      setError("We couldn't update your wishlist.");
    }
  }

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-20">
        <div className="max-w-6xl mx-auto px-4 py-10 text-sm text-muted-foreground">Loading your profile...</div>
      </div>
    );
  }

  const profile = profileData?.profile as UserProfileRecord | undefined;

  return (
    <div className="min-h-screen bg-background text-foreground pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs text-primary font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Personalization Dashboard
          </div>
          <h1 className="text-4xl font-black text-foreground">Your Profile</h1>
          <p className="text-muted-foreground mt-2">
            {user ? `${user.name.split(" ")[0]}, here’s what AutoMind has learned from your preferences and browsing behavior.` : "Manage your preferences and personalized signals."}
          </p>
        </motion.div>

        {error && (
          <div className="mb-6 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6 mb-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Preference Profile</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Min Budget (Lakh)</label>
                  <input value={form.budget_min} onChange={(e) => setForm((prev) => ({ ...prev, budget_min: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Max Budget (Lakh)</label>
                  <input value={form.budget_max} onChange={(e) => setForm((prev) => ({ ...prev, budget_max: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Household Size</label>
                  <select value={form.household_size} onChange={(e) => setForm((prev) => ({ ...prev, household_size: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60">
                    {[4, 5, 6, 7].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Primary Use</label>
                  <select value={form.primary_use} onChange={(e) => setForm((prev) => ({ ...prev, primary_use: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60">
                    {["family", "city", "highway", "fun"].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Body Types</div>
                  <div className="flex flex-wrap gap-2">
                    {BODY_TYPES.map((item) => (
                      <button key={item} type="button" onClick={() => toggleChoice("preferred_body_types", item)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.preferred_body_types.includes(item) ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Fuel Types</div>
                  <div className="flex flex-wrap gap-2">
                    {FUEL_TYPES.map((item) => (
                      <button key={item} type="button" onClick={() => toggleChoice("preferred_fuel_types", item)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.preferred_fuel_types.includes(item) ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Transmission</div>
                  <div className="flex flex-wrap gap-2">
                    {TRANSMISSIONS.map((item) => (
                      <button key={item} type="button" onClick={() => toggleChoice("preferred_transmissions", item)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.preferred_transmissions.includes(item) ? "bg-primary/10 border-primary/50 text-primary" : "border-border text-muted-foreground"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <motion.button type="submit" disabled={saving} className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {saving ? "Saving..." : "Save Preferences"}
                </motion.button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Behavior Summary</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Events", value: profileData?.stats.total_events ?? 0 },
                  { label: "Searches", value: profileData?.stats.searches ?? 0 },
                  { label: "Car Views", value: profileData?.stats.car_views ?? 0 },
                  { label: "Clicks", value: profileData?.stats.result_clicks ?? 0 },
                  { label: "Compares", value: profileData?.stats.compares ?? 0 },
                  { label: "Detail Minutes", value: profileData?.stats.detail_minutes ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="bg-background border border-border rounded-xl p-3">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-xl font-black text-primary">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Most Explored Brands</h2>
              {(profileData?.top_brands ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Browse more cars and we’ll start surfacing your strongest brand patterns.</p>
              ) : (
                <div className="space-y-3">
                  {profileData?.top_brands.map((brand) => (
                    <div key={brand.brand} className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{brand.brand}</span>
                      <span className="text-muted-foreground">{brand.count} interactions</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Recommended For You</h2>
              <p className="text-xs text-muted-foreground mt-1">These are the current strongest matches from your explicit preferences and tracked behavior.</p>
            </div>
          </div>
          {recommendations.length === 0 ? (
            <div className="text-sm text-muted-foreground">Complete onboarding and browse a few cars to unlock stronger recommendations.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendations.slice(0, 4).map((car, index) => (
                <div key={car.car_id}>
                  <CarCard
                    car={car}
                    index={index}
                    onOpen={(openedCar) => {
                      trackProfileEvent({
                        event_type: "recommendation_clicked",
                        car_id: openedCar.car_id,
                        metadata: { source: "profile_page", brand: openedCar.brand, model: openedCar.model },
                      });
                    }}
                    onFavoriteToggle={handleFavoriteToggle}
                    isFavorite={favorites.some((item) => item.carId === car.car_id)}
                  />
                  {car.recommendation_reasons && (
                    <div className="mt-2 px-1 space-y-1">
                      {car.recommendation_reasons.slice(0, 2).map((reason) => (
                        <div key={reason} className="text-xs text-muted-foreground">{reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Wishlist Snapshot</h2>
          {favorites.length === 0 ? (
            <div className="text-sm text-muted-foreground mb-6">Save cars with the heart icon and they’ll become a stronger long-term signal for recommendations.</div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-6">
              {favorites.slice(0, 8).map((favorite) => (
                <span key={favorite.id} className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary">
                  Car #{favorite.carId}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Recent Activity</h2>
          {(profileData?.recent_events ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity yet. Start exploring and we’ll build your timeline here.</div>
          ) : (
            <div className="space-y-3">
              {profileData?.recent_events.slice(0, 10).map((event) => (
                <div key={event.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/70 pb-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{event.eventType.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.queryText || (event.carId ? `Car #${event.carId}` : "Behavior signal captured")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

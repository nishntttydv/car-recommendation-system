import { getAuthHeaders } from "@/lib/auth";

export interface UserProfileRecord {
  id: number;
  userId: number;
  onboardingCompleted: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  householdSize: number | null;
  primaryUse: string | null;
  preferredBodyTypes: string[];
  preferredFuelTypes: string[];
  preferredTransmissions: string[];
  preferredBrands: string[];
  profileStage: string;
}

export interface PersonalizedCar {
  car_id: number;
  brand: string;
  model: string;
  variant_name: string;
  price_lakh: number;
  mileage_kmpl: number;
  fuel_type: string;
  transmission: string;
  body_type: string;
  safety_rating: number;
  sentiment_score: number;
  score?: number;
  image_url?: string;
  recommendation_reason?: string;
  recommendation_reasons?: string[];
}

export interface FavoriteRecord {
  id: number;
  userId: number;
  carId: number;
  createdAt: string;
}

export interface ContextualRow {
  id: string;
  title: string;
  subtitle: string;
  cars: PersonalizedCar[];
}

export async function fetchProfile() {
  const response = await fetch("/api/profile/me", {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }

  return response.json() as Promise<{
    user: { id: number; name: string; email: string };
    profile: UserProfileRecord;
    stats: {
      total_events: number;
      searches: number;
      car_views: number;
      compares: number;
      result_clicks: number;
      detail_minutes: number;
    };
    top_brands: Array<{ brand: string; count: number }>;
    favorites: FavoriteRecord[];
    recent_events: Array<{
      id: number;
      eventType: string;
      carId: number | null;
      queryText: string | null;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
  }>;
}

export async function saveOnboardingProfile(payload: Record<string, unknown>) {
  const response = await fetch("/api/profile/onboarding", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to save onboarding profile");
  }

  return response.json();
}

export async function fetchPersonalizedRecommendations() {
  const response = await fetch("/api/profile/recommendations", {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch personalized recommendations");
  }

  return response.json() as Promise<{
    profile: UserProfileRecord;
    recommendations: PersonalizedCar[];
    favorites: FavoriteRecord[];
    contextual_rows: ContextualRow[];
    based_on: { onboarding_completed: boolean; events_used: number };
  }>;
}

export async function toggleFavorite(carId: number) {
  const response = await fetch("/api/profile/favorites/toggle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ car_id: carId }),
  });

  if (!response.ok) {
    throw new Error("Failed to toggle favorite");
  }

  return response.json() as Promise<{ favorite: boolean }>;
}

export async function trackProfileEvent(payload: {
  event_type: string;
  car_id?: number;
  query_text?: string;
  metadata?: Record<string, unknown>;
}) {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return;

  await fetch("/api/profile/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

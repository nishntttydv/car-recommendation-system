import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, userEventsTable, userFavoritesTable, userProfilesTable } from "@workspace/db";
import { getAuthenticatedUser } from "../lib/auth-user";
import { loadCars, computeScore } from "../lib/csv-loader";
import { getCarImageUrl } from "../lib/image-url";
import { buildSmartFilters } from "../lib/smart-search";

const router: IRouter = Router();

type PreferenceProfileInput = {
  budget_min?: number;
  budget_max?: number;
  household_size?: number;
  primary_use?: string;
  preferred_body_types?: string[];
  preferred_fuel_types?: string[];
  preferred_transmissions?: string[];
  preferred_brands?: string[];
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parsePreferenceProfileInput(body: unknown): PreferenceProfileInput {
  const input = (body ?? {}) as Record<string, unknown>;
  return {
    budget_min: typeof input.budget_min === "number" ? input.budget_min : undefined,
    budget_max: typeof input.budget_max === "number" ? input.budget_max : undefined,
    household_size: typeof input.household_size === "number" ? input.household_size : undefined,
    primary_use: typeof input.primary_use === "string" ? input.primary_use.trim() : undefined,
    preferred_body_types: normalizeStringArray(input.preferred_body_types),
    preferred_fuel_types: normalizeStringArray(input.preferred_fuel_types),
    preferred_transmissions: normalizeStringArray(input.preferred_transmissions),
    preferred_brands: normalizeStringArray(input.preferred_brands),
  };
}

function parseEventInput(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  return {
    eventType: typeof input.event_type === "string" ? input.event_type.trim() : "",
    carId: typeof input.car_id === "number" ? input.car_id : undefined,
    queryText: typeof input.query_text === "string" ? input.query_text.trim() : undefined,
    metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : {},
  };
}

function addWeight(map: Map<string, number>, key: string | undefined, amount: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function getRecencyMultiplier(dateLike: Date | string): number {
  const eventDate = new Date(dateLike);
  const ageDays = Math.max(0, (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0.35, 1 - ageDays * 0.04);
}

function getModelKey(car: { brand: string; model: string }): string {
  return `${car.brand}::${car.model}`.toLowerCase();
}

function diversifyCars<T extends { brand: string; model: string }>(cars: T[], limit: number): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  const leftovers: T[] = [];

  for (const car of cars) {
    const key = getModelKey(car);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(car);
    } else {
      leftovers.push(car);
    }
    if (unique.length === limit) return unique;
  }

  for (const car of leftovers) {
    unique.push(car);
    if (unique.length === limit) break;
  }

  return unique;
}

async function getOrCreateProfile(userId: number) {
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (existing) return existing;

  const [created] = await db.insert(userProfilesTable).values({ userId }).returning();
  return created;
}

function createCarLookup(cars = loadCars()) {
  const byId = new Map<number, (typeof cars)[number]>();
  for (const car of cars) byId.set(car.car_id, car);
  return byId;
}

function getContextualRows(
  allCars: ReturnType<typeof loadCars>,
  favorites: number[],
  queryFilters: ReturnType<typeof buildSmartFilters>[],
  viewedModelKeys: string[],
) {
  const rows: Array<{ id: string; title: string; subtitle: string; cars: Array<Record<string, unknown>> }> = [];

  if (favorites.length > 0) {
    const favoriteCars = allCars
      .filter((car) => favorites.includes(car.car_id))
      .map((car) => ({
        ...car,
        image_url: getCarImageUrl(car.brand, car.model),
      }))
      .slice(0, 8);

    if (favoriteCars.length > 0) {
      rows.push({
        id: "favorites",
        title: "Your Wishlist",
        subtitle: "Cars you explicitly saved for later.",
        cars: favoriteCars,
      });
    }
  }

  const recentQueryFilter = queryFilters.find((filter) => filter.brand || filter.body_type || filter.fuel_type || filter.transmission);
  if (recentQueryFilter) {
    const matching = allCars
      .filter((car) => {
        if (recentQueryFilter.brand && car.brand !== recentQueryFilter.brand) return false;
        if (recentQueryFilter.body_type && car.body_type !== recentQueryFilter.body_type) return false;
        if (recentQueryFilter.fuel_type && car.fuel_type !== recentQueryFilter.fuel_type) return false;
        if (recentQueryFilter.transmission && car.transmission !== recentQueryFilter.transmission) return false;
        if (recentQueryFilter.budget_min != null && car.price_lakh < recentQueryFilter.budget_min) return false;
        if (recentQueryFilter.budget_max != null && car.price_lakh > recentQueryFilter.budget_max) return false;
        return true;
      })
      .map((car) => ({ ...car, score: computeScore(car), image_url: getCarImageUrl(car.brand, car.model) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const diversified = diversifyCars(matching, 6);
    if (diversified.length > 0) {
      rows.push({
        id: "recent-search",
        title: "Because You Recently Searched",
        subtitle: "Fresh picks aligned to your latest search intent.",
        cars: diversified,
      });
    }
  }

  if (viewedModelKeys.length > 0) {
    const related = allCars
      .filter((car) => !viewedModelKeys.includes(getModelKey(car)))
      .map((car) => {
        let score = computeScore(car) * 100;
        for (const viewedModelKey of viewedModelKeys) {
          const [brand] = viewedModelKey.split("::");
          if (car.brand.toLowerCase() === brand) score += 12;
        }
        return { ...car, score, image_url: getCarImageUrl(car.brand, car.model) };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const diversified = diversifyCars(related, 6);
    if (diversified.length > 0) {
      rows.push({
        id: "viewed-cars",
        title: "More Like What You Viewed",
        subtitle: "Similar options inspired by your recent detail-page visits.",
        cars: diversified,
      });
    }
  }

  return rows.slice(0, 3);
}

router.get("/profile/me", async (req, res): Promise<void> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await getOrCreateProfile(user.id);
  const favorites = await db
    .select()
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.userId, user.id))
    .orderBy(desc(userFavoritesTable.createdAt));
  const recentEvents = await db
    .select()
    .from(userEventsTable)
    .where(eq(userEventsTable.userId, user.id))
    .orderBy(desc(userEventsTable.createdAt))
    .limit(50);

  const allCars = loadCars();
  const topBrandMap = new Map<string, number>();
  let totalTimeMs = 0;

  for (const event of recentEvents) {
    if (event.eventType === "car_detail_time_spent") {
      totalTimeMs += Number(event.metadata?.duration_ms ?? 0);
    }
    if (!event.carId) continue;
    const car = allCars.find((item) => item.car_id === event.carId);
    if (!car) continue;
    addWeight(topBrandMap, car.brand, 1);
  }

  const topBrands = [...topBrandMap.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    user: { id: user.id, name: user.name, email: user.email },
    profile,
    favorites,
    stats: {
      total_events: recentEvents.length,
      searches: recentEvents.filter((event) => event.eventType === "search_submitted").length,
      car_views: recentEvents.filter((event) => event.eventType === "car_viewed").length,
      compares: recentEvents.filter((event) => event.eventType === "compare_started").length,
      result_clicks: recentEvents.filter((event) => event.eventType === "search_result_clicked" || event.eventType === "recommendation_clicked").length,
      detail_minutes: Math.round((totalTimeMs / 60000) * 10) / 10,
    },
    top_brands: topBrands,
    recent_events: recentEvents,
  });
});

router.put("/profile/onboarding", async (req, res): Promise<void> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = parsePreferenceProfileInput(req.body);

  const [profile] = await db
    .insert(userProfilesTable)
    .values({
      userId: user.id,
      onboardingCompleted: true,
      budgetMin: parsed.budget_min,
      budgetMax: parsed.budget_max,
      householdSize: parsed.household_size,
      primaryUse: parsed.primary_use,
      preferredBodyTypes: parsed.preferred_body_types ?? [],
      preferredFuelTypes: parsed.preferred_fuel_types ?? [],
      preferredTransmissions: parsed.preferred_transmissions ?? [],
      preferredBrands: parsed.preferred_brands ?? [],
      profileStage: "active",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      set: {
        onboardingCompleted: true,
        budgetMin: parsed.budget_min,
        budgetMax: parsed.budget_max,
        householdSize: parsed.household_size,
        primaryUse: parsed.primary_use,
        preferredBodyTypes: parsed.preferred_body_types ?? [],
        preferredFuelTypes: parsed.preferred_fuel_types ?? [],
        preferredTransmissions: parsed.preferred_transmissions ?? [],
        preferredBrands: parsed.preferred_brands ?? [],
        profileStage: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  await db.insert(userEventsTable).values({
    userId: user.id,
    eventType: "onboarding_completed",
    metadata: parsed as Record<string, unknown>,
  });

  res.json({ profile });
});

router.post("/profile/events", async (req, res): Promise<void> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = parseEventInput(req.body);
  if (!parsed.eventType) {
    res.status(400).json({ error: "event_type is required" });
    return;
  }

  await db.insert(userEventsTable).values({
    userId: user.id,
    eventType: parsed.eventType,
    carId: parsed.carId,
    queryText: parsed.queryText,
    metadata: parsed.metadata,
  });

  res.json({ ok: true });
});

router.post("/profile/favorites/toggle", async (req, res): Promise<void> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const carId = typeof (req.body as Record<string, unknown>)?.car_id === "number"
    ? (req.body as Record<string, number>).car_id
    : undefined;

  if (!carId) {
    res.status(400).json({ error: "car_id is required" });
    return;
  }

  const favorites = await db.select().from(userFavoritesTable).where(eq(userFavoritesTable.userId, user.id));
  const existing = favorites.find((item) => item.carId === carId);
  const alreadyFavorite = Boolean(existing);

  if (alreadyFavorite) {
    if (existing) {
      await db.delete(userFavoritesTable).where(eq(userFavoritesTable.id, existing.id));
    }
    await db.insert(userEventsTable).values({
      userId: user.id,
      eventType: "favorite_removed",
      carId,
      metadata: { source: "ui" },
    });
    res.json({ favorite: false });
    return;
  }

  await db.insert(userFavoritesTable).values({ userId: user.id, carId });
  await db.insert(userEventsTable).values({
    userId: user.id,
    eventType: "favorite_added",
    carId,
    metadata: { source: "ui" },
  });
  res.json({ favorite: true });
});

router.get("/profile/recommendations", async (req, res): Promise<void> => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await getOrCreateProfile(user.id);
  const favoriteRows = await db
    .select()
    .from(userFavoritesTable)
    .where(eq(userFavoritesTable.userId, user.id))
    .orderBy(desc(userFavoritesTable.createdAt));
  const events = await db
    .select()
    .from(userEventsTable)
    .where(eq(userEventsTable.userId, user.id))
    .orderBy(desc(userEventsTable.createdAt))
    .limit(100);

  const viewedCarIds = new Set<number>();
  const allCars = loadCars();
  const carById = createCarLookup(allCars);
  const favoriteCarIds = new Set(favoriteRows.map((row) => row.carId));
  const queryFilters = events
    .filter((event) => event.queryText)
    .map((event) => buildSmartFilters(event.queryText ?? ""));

  for (const event of events) {
    if (event.carId) viewedCarIds.add(event.carId);
  }

  const brandWeight = new Map<string, number>();
  const modelWeight = new Map<string, number>();
  const bodyWeight = new Map<string, number>();
  const fuelWeight = new Map<string, number>();
  const transmissionWeight = new Map<string, number>();

  const viewedModelKeys: string[] = [];

  for (const event of events) {
    if ((event.eventType === "car_viewed" || event.eventType === "search_result_clicked" || event.eventType === "recommendation_clicked") && event.carId) {
      const car = carById.get(event.carId);
      if (!car) continue;
      const clickBoost = (event.eventType === "car_viewed" ? 4 : 5) * getRecencyMultiplier(event.createdAt);
      addWeight(brandWeight, car.brand, clickBoost);
      addWeight(modelWeight, getModelKey(car), clickBoost + 1);
      addWeight(bodyWeight, car.body_type, 3);
      addWeight(fuelWeight, car.fuel_type, 2);
      addWeight(transmissionWeight, car.transmission, 2);
      if (event.eventType === "car_viewed") viewedModelKeys.push(getModelKey(car));
    }

    if (event.eventType === "compare_started") {
      const comparedIds = Array.isArray(event.metadata?.car_ids) ? event.metadata.car_ids : [];
      for (const comparedId of comparedIds) {
        const car = carById.get(Number(comparedId));
        if (!car) continue;
        const eventBoost = 5 * getRecencyMultiplier(event.createdAt);
        addWeight(brandWeight, car.brand, eventBoost);
        addWeight(modelWeight, getModelKey(car), eventBoost + 1);
        addWeight(bodyWeight, car.body_type, 3 * getRecencyMultiplier(event.createdAt));
      }
    }

    if (event.eventType === "car_detail_time_spent" && event.carId) {
      const car = carById.get(event.carId);
      if (!car) continue;
      const durationMs = Number(event.metadata?.duration_ms ?? 0);
      const attentionBoost = Math.min(8, Math.max(0, durationMs / 15000)) * getRecencyMultiplier(event.createdAt);
      addWeight(brandWeight, car.brand, attentionBoost);
      addWeight(modelWeight, getModelKey(car), attentionBoost + 1);
    }
  }

  for (const favoriteCarId of favoriteCarIds) {
    const car = carById.get(favoriteCarId);
    if (!car) continue;
    addWeight(brandWeight, car.brand, 12);
    addWeight(modelWeight, getModelKey(car), 16);
    addWeight(bodyWeight, car.body_type, 5);
    addWeight(fuelWeight, car.fuel_type, 4);
    addWeight(transmissionWeight, car.transmission, 4);
  }

  for (const filters of queryFilters) {
    addWeight(brandWeight, filters.brand, 3);
    addWeight(bodyWeight, filters.body_type, 2);
    addWeight(fuelWeight, filters.fuel_type, 2);
    addWeight(transmissionWeight, filters.transmission, 2);
  }

  const filteredCars = allCars.filter((car) => {
    if (profile.budgetMin != null && car.price_lakh < profile.budgetMin) return false;
    if (profile.budgetMax != null && car.price_lakh > profile.budgetMax) return false;
    if (profile.householdSize != null && profile.householdSize > 4 && car.seating_capacity < profile.householdSize) return false;
    if (profile.preferredBodyTypes.length > 0 && !profile.preferredBodyTypes.includes(car.body_type)) return false;
    if (profile.preferredFuelTypes.length > 0 && !profile.preferredFuelTypes.includes(car.fuel_type)) return false;
    if (profile.preferredTransmissions.length > 0 && !profile.preferredTransmissions.includes(car.transmission)) return false;
    return true;
  });

  const personalized = filteredCars
    .map((car) => {
      let score = computeScore(car) * 100;
      const reasons: string[] = [];

      if (profile.preferredBrands.includes(car.brand)) {
        score += 12;
        reasons.push(`Matches your preferred brand: ${car.brand}`);
      }
      if (profile.primaryUse === "family" && (car.seating_capacity >= 6 || car.body_type === "MPV")) {
        score += 14;
        reasons.push("Good match for family-focused use");
      }
      if (profile.primaryUse === "city" && car.body_type === "Hatchback") {
        score += 12;
        reasons.push("Fits your city-driving preference");
      }
      if (profile.primaryUse === "highway" && (car.body_type === "SUV" || car.body_type === "Sedan")) {
        score += 12;
        reasons.push("Fits your highway-driving preference");
      }

      score += (brandWeight.get(car.brand) ?? 0) * 3;
      score += (modelWeight.get(getModelKey(car)) ?? 0) * 4;
      score += (bodyWeight.get(car.body_type) ?? 0) * 2;
      score += (fuelWeight.get(car.fuel_type) ?? 0) * 1.5;
      score += (transmissionWeight.get(car.transmission) ?? 0) * 1.5;

      if (favoriteCarIds.has(car.car_id)) {
        score += 25;
        reasons.push("Saved in your wishlist");
      }

      if ((modelWeight.get(getModelKey(car)) ?? 0) > 0) {
        reasons.push("Similar to cars you explored recently");
      } else if ((brandWeight.get(car.brand) ?? 0) > 0) {
        reasons.push(`You keep coming back to ${car.brand}`);
      }

      if (viewedCarIds.has(car.car_id)) {
        score -= 6;
      }

      if (reasons.length === 0 && events.length > 0) {
        reasons.push("Suggested from your recent browsing");
      }

      if (reasons.length === 0) {
        reasons.push("Recommended from your saved profile");
      }

      return {
        ...car,
        score: Math.round(score) / 100,
        recommendation_reason: reasons[0],
        recommendation_reasons: reasons.slice(0, 3),
        image_url: getCarImageUrl(car.brand, car.model),
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const recommendations = diversifyCars(personalized, 8);

  res.json({
    profile,
    recommendations,
    favorites: favoriteRows,
    contextual_rows: getContextualRows(allCars, [...favoriteCarIds], queryFilters, viewedModelKeys.slice(0, 6)),
    based_on: {
      onboarding_completed: profile.onboardingCompleted,
      events_used: events.length,
    },
  });
});

export default router;

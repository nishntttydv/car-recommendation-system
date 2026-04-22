import { Router, type IRouter } from "express";
import { loadCars, computeScore, fuzzyMatchBrand, fuzzyMatchModel } from "../lib/csv-loader";
import { getCarImageUrl } from "../lib/image-url";
import { processCarQuery } from "../lib/gemini";
import { buildSmartFilters, fuzzyTextSearch, scoreSmartMatch } from "../lib/smart-search";
import { ProcessQueryBody } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_BODY_TYPES = new Set(["Hatchback", "Sedan", "SUV", "MPV", "Coupe", "Convertible", "Pickup", "Wagon"]);
const VALID_FUEL_TYPES = new Set(["Petrol", "Diesel", "Electric", "CNG", "Hybrid"]);
const VALID_TRANSMISSIONS = new Set(["Manual", "Automatic"]);
const SEARCH_RESULT_LIMIT = 30;

type SearchResultCar = Record<string, unknown> & {
  car_id: number;
  brand: string;
  model: string;
  variant_name: string;
  relevance_score: number;
};

function isSearchReadyCar(car: Record<string, unknown>): boolean {
  const price = Number(car.price_lakh ?? 0);
  const seating = Number(car.seating_capacity ?? 0);
  const safety = Number(car.safety_rating ?? 0);
  const sentiment = Number(car.sentiment_score ?? 0);
  const model = String(car.model ?? "").trim();
  const variant = String(car.variant_name ?? "").trim();

  return (
    String(car.brand ?? "").trim().length > 0 &&
    model.length > 0 &&
    !/^\d{4}$/.test(model) &&
    !/^\d{4}$/.test(variant) &&
    VALID_BODY_TYPES.has(String(car.body_type ?? "")) &&
    VALID_FUEL_TYPES.has(String(car.fuel_type ?? "")) &&
    VALID_TRANSMISSIONS.has(String(car.transmission ?? "")) &&
    Number.isFinite(price) &&
    price >= 2 &&
    price <= 100 &&
    Number.isFinite(seating) &&
    seating >= 2 &&
    seating <= 9 &&
    Number.isFinite(safety) &&
    safety >= 0 &&
    safety <= 5 &&
    Number.isFinite(sentiment) &&
    sentiment >= 0 &&
    sentiment <= 1
  );
}

function getModelKey(car: Pick<SearchResultCar, "brand" | "model">): string {
  return `${car.brand}::${car.model}`.toLowerCase();
}

function diversifySearchResults(scoredCars: SearchResultCar[], limit: number): SearchResultCar[] {
  const perModelCount = new Map<string, number>();
  const diversified: SearchResultCar[] = [];
  const leftovers: SearchResultCar[] = [];

  for (const car of scoredCars) {
    const modelKey = getModelKey(car);
    if (!perModelCount.has(modelKey)) {
      diversified.push(car);
      perModelCount.set(modelKey, 1);
      if (diversified.length === limit) return diversified;
    } else {
      leftovers.push(car);
    }
  }

  for (const car of leftovers) {
    const modelKey = getModelKey(car);
    const currentCount = perModelCount.get(modelKey) ?? 0;
    if (currentCount >= 2) continue;

    diversified.push(car);
    perModelCount.set(modelKey, currentCount + 1);
    if (diversified.length === limit) break;
  }

  return diversified;
}

function selectSearchResults(
  scoredCars: SearchResultCar[],
  limit: number,
  opts: { preserveVariantsForModelSearch: boolean },
): SearchResultCar[] {
  if (opts.preserveVariantsForModelSearch) {
    return scoredCars.slice(0, limit);
  }

  return diversifySearchResults(scoredCars, limit);
}

router.post("/query-process", async (req, res): Promise<void> => {
  const parsed = ProcessQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { query } = parsed.data;
  let allCars = loadCars().filter((car) => isSearchReadyCar(car as unknown as Record<string, unknown>));
  const brands = [...new Set(allCars.map((c) => c.brand))];
  const models = [...new Set(allCars.map((c) => c.model))];

  let correctedQuery = query;
  let intent = "";
  let geminiFilters: Awaited<ReturnType<typeof processCarQuery>>["filters"] = {};
  let geminiOk = false;

  // --- Step 1: Try Gemini NLP ---
  try {
    const result = await processCarQuery(query);
    correctedQuery = result.corrected_query;
    geminiFilters = result.filters;
    intent = result.intent;
    geminiOk = true;
  } catch (e) {
    console.error("[query-process] Gemini failed, using local fallback:", e);
  }

  // --- Step 2: Local smart-search as baseline / augmentation ---
  const localFilters = buildSmartFilters(query);

  // Merge: Gemini takes priority, local fills gaps
  const mergedTransmission = geminiFilters.transmission ?? localFilters.transmission;
  const mergedFuelType = geminiFilters.fuel_type ?? localFilters.fuel_type;
  const mergedBodyType = geminiFilters.body_type ?? localFilters.body_type;
  const mergedBudgetMax = geminiFilters.budget_max ?? localFilters.budget_max;
  const mergedBudgetMin = geminiFilters.budget_min ?? localFilters.budget_min;
  const mergedSeating = geminiFilters.seating_capacity ?? localFilters.seating_capacity;

  // --- Step 3: Apply structured filters ---
  let cars = allCars as unknown as Array<Record<string, unknown>>;

  // Brand matching (fuzzy)
  const brandToUse = geminiFilters.brand ?? localFilters.brand;
  if (brandToUse) {
    const matched = fuzzyMatchBrand(brandToUse, brands);
    if (matched) {
      cars = cars.filter((c) => (c.brand as string).toLowerCase() === matched.toLowerCase());
    } else {
      cars = [];
    }
  }

  // Model matching (fuzzy)
  const modelToUse = geminiFilters.model ?? localFilters.model;
  if (modelToUse) {
    const matched = fuzzyMatchModel(modelToUse, models);
    if (matched) {
      cars = cars.filter((c) => (c.model as string).toLowerCase() === matched.toLowerCase());
    }
  }

  // Structured filters
  if (mergedBodyType) cars = cars.filter((c) => (c.body_type as string).toLowerCase() === mergedBodyType.toLowerCase());
  if (mergedFuelType) cars = cars.filter((c) => (c.fuel_type as string).toLowerCase() === mergedFuelType.toLowerCase());
  if (mergedTransmission) cars = cars.filter((c) => (c.transmission as string).toLowerCase() === mergedTransmission.toLowerCase());
  if (mergedBudgetMax != null) cars = cars.filter((c) => (c.price_lakh as number) <= mergedBudgetMax);
  if (mergedBudgetMin != null) cars = cars.filter((c) => (c.price_lakh as number) >= mergedBudgetMin);
  if (mergedSeating != null) cars = cars.filter((c) => (c.seating_capacity as number) >= mergedSeating);

  // Feature filters
  const featuresToApply = geminiFilters.features ?? [];
  if (featuresToApply.includes("sunroof") || localFilters.feature_sunroof) cars = cars.filter((c) => c.sunroof === "Yes");
  if (featuresToApply.includes("abs") || localFilters.feature_abs) cars = cars.filter((c) => c.abs === "Yes");
  if (featuresToApply.includes("touchscreen") || localFilters.feature_touchscreen) cars = cars.filter((c) => c.touchscreen === "Yes");
  if (featuresToApply.includes("cruise_control") || localFilters.feature_cruise_control) cars = cars.filter((c) => c.cruise_control === "Yes");
  if (featuresToApply.includes("rear_camera") || localFilters.feature_rear_camera) cars = cars.filter((c) => c.rear_camera === "Yes");
  if (localFilters.safety_min != null) cars = cars.filter((c) => (c.safety_rating as number) >= localFilters.safety_min!);

  // --- Step 4: If still no structured filters extracted at all, fuzzy text search ---
  const hasAnyFilter = brandToUse || modelToUse || mergedBodyType || mergedFuelType ||
    mergedTransmission || mergedBudgetMax != null || mergedBudgetMin != null ||
    mergedSeating != null || featuresToApply.length > 0 ||
    localFilters.feature_sunroof || localFilters.feature_abs ||
    localFilters.feature_touchscreen || localFilters.feature_cruise_control ||
    localFilters.feature_rear_camera || localFilters.safety_min != null ||
    localFilters.family_friendly || localFilters.comfort_priority ||
    localFilters.fun_to_drive || localFilters.city_friendly ||
    localFilters.highway_friendly || localFilters.low_maintenance ||
    localFilters.rough_road_ready || localFilters.premium_preference ||
    localFilters.mileage_priority || localFilters.first_car;

  if (!hasAnyFilter) {
    // Full fuzzy text search across all cars
    cars = fuzzyTextSearch(allCars as unknown as Array<Record<string, unknown>>, query);
  }

  // --- Step 5: Score and return ---
  const rawCars = allCars as unknown as Array<Record<string, unknown>>;
  const scored = cars
    .map((c) => {
      const original = rawCars.find((r) => r.car_id === c.car_id);
      const baseCar = (original ?? c) as Record<string, unknown>;
      const overallScore = computeScore(baseCar as Parameters<typeof computeScore>[0]);
      const intentBoost = scoreSmartMatch(baseCar, localFilters, query);
      return {
        ...baseCar,
        score: overallScore,
        relevance_score: overallScore * 100 + intentBoost,
        image_url: getCarImageUrl(String(c.brand ?? ""), String(c.model ?? "")),
      };
    })
    .sort((a, b) => ((b.relevance_score as number) ?? 0) - ((a.relevance_score as number) ?? 0));

  const diversifiedResults = selectSearchResults(
    scored as SearchResultCar[],
    SEARCH_RESULT_LIMIT,
    { preserveVariantsForModelSearch: Boolean(modelToUse) },
  );
  const uniqueModelsShown = new Set(diversifiedResults.map((car) => getModelKey(car))).size;

  const filtersReturned: Record<string, unknown> = {};
  if (brandToUse) filtersReturned.brand = brandToUse;
  if (modelToUse) filtersReturned.model = modelToUse;
  if (mergedBodyType) filtersReturned.body_type = mergedBodyType;
  if (mergedFuelType) filtersReturned.fuel_type = mergedFuelType;
  if (mergedTransmission) filtersReturned.transmission = mergedTransmission;
  if (mergedBudgetMax != null) filtersReturned.budget_max = mergedBudgetMax;
  if (mergedBudgetMin != null) filtersReturned.budget_min = mergedBudgetMin;
  if (mergedSeating != null) filtersReturned.seating_capacity = mergedSeating;
  if (localFilters.family_friendly) filtersReturned.intent_family = true;
  if (localFilters.comfort_priority) filtersReturned.intent_comfort = true;
  if (localFilters.fun_to_drive) filtersReturned.intent_fun = true;
  if (localFilters.city_friendly) filtersReturned.intent_city = true;
  if (localFilters.highway_friendly) filtersReturned.intent_highway = true;
  if (localFilters.low_maintenance) filtersReturned.intent_low_maintenance = true;
  if (localFilters.rough_road_ready) filtersReturned.intent_rough_road = true;
  if (localFilters.premium_preference) filtersReturned.intent_premium = true;
  if (localFilters.mileage_priority) filtersReturned.intent_mileage = true;
  if (localFilters.first_car) filtersReturned.intent_first_car = true;
  // Feature filters
  const activeFeatures: string[] = [];
  if (featuresToApply.includes("sunroof") || localFilters.feature_sunroof) activeFeatures.push("sunroof");
  if (featuresToApply.includes("abs") || localFilters.feature_abs) activeFeatures.push("abs");
  if (featuresToApply.includes("touchscreen") || localFilters.feature_touchscreen) activeFeatures.push("touchscreen");
  if (featuresToApply.includes("cruise_control") || localFilters.feature_cruise_control) activeFeatures.push("cruise control");
  if (featuresToApply.includes("rear_camera") || localFilters.feature_rear_camera) activeFeatures.push("rear camera");
  if (activeFeatures.length > 0) filtersReturned.features = activeFeatures.join(", ");

  res.json({
    original_query: query,
    corrected_query: correctedQuery,
    intent,
    filters: filtersReturned,
    cars: diversifiedResults,
    total: cars.length,
    shown: diversifiedResults.length,
    unique_models_shown: uniqueModelsShown,
    message: `Found ${cars.length} cars matching your search. Showing ${diversifiedResults.length} results across ${uniqueModelsShown} models.`,
    source: geminiOk ? "gemini+local" : "local",
  });
});

export default router;

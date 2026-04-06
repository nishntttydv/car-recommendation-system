import { Router, type IRouter } from "express";
import { loadCars, computeScore, fuzzyMatchBrand, fuzzyMatchModel } from "../lib/csv-loader";
import { processCarQuery } from "../lib/gemini";
import { buildSmartFilters, applySmartFilters, fuzzyTextSearch } from "../lib/smart-search";
import { ProcessQueryBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/query-process", async (req, res): Promise<void> => {
  const parsed = ProcessQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { query } = parsed.data;
  let allCars = loadCars();
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
    localFilters.feature_rear_camera || localFilters.safety_min != null;

  if (!hasAnyFilter) {
    // Full fuzzy text search across all cars
    cars = fuzzyTextSearch(allCars as unknown as Array<Record<string, unknown>>, query);
  }

  // --- Step 5: Score and return ---
  const rawCars = allCars as unknown as Array<Record<string, unknown>>;
  const scored = cars
    .map((c) => {
      const original = rawCars.find((r) => r.car_id === c.car_id);
      return {
        ...(original ?? c),
        score: computeScore(original as Parameters<typeof computeScore>[0] ?? (c as Parameters<typeof computeScore>[0])),
        image_url: `/api/images/${c.car_id}`,
      };
    })
    .sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0))
    .slice(0, 30);

  const filtersReturned: Record<string, unknown> = {};
  if (brandToUse) filtersReturned.brand = brandToUse;
  if (modelToUse) filtersReturned.model = modelToUse;
  if (mergedBodyType) filtersReturned.body_type = mergedBodyType;
  if (mergedFuelType) filtersReturned.fuel_type = mergedFuelType;
  if (mergedTransmission) filtersReturned.transmission = mergedTransmission;
  if (mergedBudgetMax != null) filtersReturned.budget_max = mergedBudgetMax;
  if (mergedBudgetMin != null) filtersReturned.budget_min = mergedBudgetMin;
  if (mergedSeating != null) filtersReturned.seating_capacity = mergedSeating;
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
    cars: scored,
    total: cars.length,
    message: `Found ${cars.length} cars matching your search.`,
    source: geminiOk ? "gemini+local" : "local",
  });
});

export default router;

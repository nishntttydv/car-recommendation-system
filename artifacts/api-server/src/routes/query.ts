import { Router, type IRouter } from "express";
import { loadCars, computeScore, fuzzyMatchBrand, fuzzyMatchModel } from "../lib/csv-loader";
import { processCarQuery } from "../lib/gemini";
import { ProcessQueryBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/query-process", async (req, res): Promise<void> => {
  const parsed = ProcessQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { query } = parsed.data;

  let correctedQuery = query;
  let filters: {
    brand?: string;
    model?: string;
    body_type?: string;
    fuel_type?: string;
    transmission?: string;
    budget_max?: number;
    budget_min?: number;
    seating_capacity?: number;
  } = {};

  try {
    const result = await processCarQuery(query);
    correctedQuery = result.corrected_query;
    filters = result.filters;
  } catch {
    // Fall back to basic text search
  }

  let cars = loadCars();
  const brands = [...new Set(cars.map((c) => c.brand))];
  const models = [...new Set(cars.map((c) => c.model))];

  if (filters.brand) {
    const matched = fuzzyMatchBrand(filters.brand, brands);
    if (matched) {
      cars = cars.filter((c) => c.brand.toLowerCase() === matched.toLowerCase());
    }
  }

  if (filters.model) {
    const matched = fuzzyMatchModel(filters.model, models);
    if (matched) {
      cars = cars.filter((c) => c.model.toLowerCase() === matched.toLowerCase());
    }
  }

  if (filters.body_type) {
    cars = cars.filter((c) => c.body_type.toLowerCase() === filters.body_type!.toLowerCase());
  }

  if (filters.fuel_type) {
    cars = cars.filter((c) => c.fuel_type.toLowerCase() === filters.fuel_type!.toLowerCase());
  }

  if (filters.transmission) {
    cars = cars.filter((c) => c.transmission.toLowerCase() === filters.transmission!.toLowerCase());
  }

  if (filters.budget_max != null) {
    cars = cars.filter((c) => c.price_lakh <= filters.budget_max!);
  }

  if (filters.budget_min != null) {
    cars = cars.filter((c) => c.price_lakh >= filters.budget_min!);
  }

  if (filters.seating_capacity != null) {
    cars = cars.filter((c) => c.seating_capacity >= filters.seating_capacity!);
  }

  // If no filters were extracted, try a plain-text search
  if (Object.keys(filters).length === 0) {
    const q = query.toLowerCase();
    cars = cars.filter(
      (c) =>
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.variant_name.toLowerCase().includes(q) ||
        c.body_type.toLowerCase().includes(q) ||
        c.fuel_type.toLowerCase().includes(q)
    );
  }

  const carsWithScore = cars
    .map((c) => ({
      ...c,
      score: computeScore(c),
      image_url: `/api/images/${c.car_id}`,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 20);

  res.json({
    original_query: query,
    corrected_query: correctedQuery,
    filters,
    cars: carsWithScore,
    total: cars.length,
    message: `Found ${cars.length} cars matching your search.`,
  });
});

export default router;

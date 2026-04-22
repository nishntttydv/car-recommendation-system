import { Router, type IRouter } from "express";
import { loadCars, computeScore } from "../lib/csv-loader";
import { generateCarInsights } from "../lib/gemini";
import { getCarImageUrl } from "../lib/image-url";
import { GetCarInsightsParams } from "@workspace/api-zod";

const router: IRouter = Router();

function getModelKey(car: { brand: string; model: string }): string {
  return `${car.brand}::${car.model}`.toLowerCase();
}

function pickDistinctModels<T extends { brand: string; model: string }>(cars: T[], limit: number): T[] {
  const seenModels = new Set<string>();
  const distinct: T[] = [];

  for (const car of cars) {
    const modelKey = getModelKey(car);
    if (seenModels.has(modelKey)) continue;

    seenModels.add(modelKey);
    distinct.push(car);

    if (distinct.length === limit) break;
  }

  return distinct;
}

router.get("/insights/market-overview", async (_req, res): Promise<void> => {
  const cars = loadCars();
  const carsWithScore = cars.map((c) => ({ ...c, score: computeScore(c) }));

  const brandMap: Record<string, { count: number; totalScore: number }> = {};
  for (const car of carsWithScore) {
    if (!brandMap[car.brand]) {
      brandMap[car.brand] = { count: 0, totalScore: 0 };
    }
    brandMap[car.brand].count++;
    brandMap[car.brand].totalScore += car.score ?? 0;
  }

  const top_brands = Object.entries(brandMap)
    .map(([brand, { count, totalScore }]) => ({
      brand,
      count,
      avg_score: Math.round((totalScore / count) * 100) / 100,
    }))
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 8);

  const bodyTypeMap: Record<string, number> = {};
  for (const car of cars) {
    bodyTypeMap[car.body_type] = (bodyTypeMap[car.body_type] || 0) + 1;
  }
  const popular_body_types = Object.entries(bodyTypeMap)
    .map(([body_type, count]) => ({ body_type, count }))
    .sort((a, b) => b.count - a.count);

  const budget_segments = [
    { segment: "Entry Level", range: "Under ₹7L", count: cars.filter((c) => c.price_lakh < 7).length },
    { segment: "Budget", range: "₹7-12L", count: cars.filter((c) => c.price_lakh >= 7 && c.price_lakh < 12).length },
    { segment: "Mid-Range", range: "₹12-20L", count: cars.filter((c) => c.price_lakh >= 12 && c.price_lakh < 20).length },
    { segment: "Premium", range: "₹20-35L", count: cars.filter((c) => c.price_lakh >= 20 && c.price_lakh < 35).length },
    { segment: "Luxury", range: "Above ₹35L", count: cars.filter((c) => c.price_lakh >= 35).length },
  ];

  const best_value_cars = pickDistinctModels(
    [...carsWithScore]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((c) => ({
      ...c,
      image_url: getCarImageUrl(c.brand, c.model),
    })),
    5,
  );

  res.json({
    top_brands,
    popular_body_types,
    budget_segments,
    best_value_cars,
  });
});

router.get("/insights/:carId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.carId) ? req.params.carId[0] : req.params.carId;
  const parsed = GetCarInsightsParams.safeParse({ carId: parseInt(rawId, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid car ID" });
    return;
  }

  const { carId } = parsed.data;
  const cars = loadCars();
  const car = cars.find((c) => c.car_id === carId);

  if (!car) {
    res.status(404).json({ error: "Car not found" });
    return;
  }

  const insights = await generateCarInsights(car);

  res.json({
    car_id: car.car_id,
    brand: car.brand,
    model: car.model,
    ...insights,
  });
});

export default router;

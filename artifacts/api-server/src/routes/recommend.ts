import { Router, type IRouter } from "express";
import { loadCars, computeScore } from "../lib/csv-loader";
import { GetRecommendationsBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/recommend", async (req, res): Promise<void> => {
  const parsed = GetRecommendationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const {
    budget_max,
    budget_min,
    fuel_type,
    transmission,
    body_type,
    seating_capacity,
  } = parsed.data;

  let cars = loadCars();

  if (budget_max != null) {
    cars = cars.filter((c) => c.price_lakh <= budget_max);
  }

  if (budget_min != null) {
    cars = cars.filter((c) => c.price_lakh >= budget_min);
  }

  if (fuel_type) {
    cars = cars.filter((c) => c.fuel_type.toLowerCase() === fuel_type.toLowerCase());
  }

  if (transmission) {
    cars = cars.filter((c) => c.transmission.toLowerCase() === transmission.toLowerCase());
  }

  if (body_type) {
    cars = cars.filter((c) => c.body_type.toLowerCase() === body_type.toLowerCase());
  }

  if (seating_capacity != null) {
    cars = cars.filter((c) => c.seating_capacity >= seating_capacity);
  }

  const carsWithScore = cars.map((c) => ({
    ...c,
    score: computeScore(c),
    image_url: `/api/images/${c.car_id}`,
  }));

  carsWithScore.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const top5 = carsWithScore.slice(0, 5);

  res.json({ recommendations: top5, total: cars.length });
});

export default router;

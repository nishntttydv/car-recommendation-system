import { Router, type IRouter } from "express";
import { loadCars, computeScore } from "../lib/csv-loader";
import { getCarImageUrl } from "../lib/image-url";
import { CompareCarsBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/compare", async (req, res): Promise<void> => {
  const parsed = CompareCarsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { car_ids } = parsed.data;
  const allCars = loadCars();

  const cars = car_ids
    .map((id) => {
      const car = allCars.find((c) => c.car_id === id);
      if (!car) return null;
      return {
        ...car,
        score: computeScore(car),
        image_url: getCarImageUrl(car.brand, car.model),
      };
    })
    .filter(Boolean);

  if (cars.length < 2) {
    res.status(400).json({ error: "At least 2 valid car IDs are required" });
    return;
  }

  const winner = cars.reduce((best, car) => {
    if (!best || (car?.score ?? 0) > (best?.score ?? 0)) return car;
    return best;
  });

  res.json({
    cars,
    winner: {
      car_id: winner?.car_id,
      reason: `${winner?.brand} ${winner?.model} wins with the highest overall score of ${(winner?.score ?? 0).toFixed(2)}, balancing price, mileage, safety, and features.`,
    },
  });
});

export default router;

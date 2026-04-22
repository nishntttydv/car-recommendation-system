import { Router, type IRouter } from "express";
import { loadCars, computeScore, fuzzyMatchBrand, fuzzyMatchModel } from "../lib/csv-loader";
import { getCarImageUrl } from "../lib/image-url";
import { GetCarsQueryParams, GetCarByIdParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cars", async (req, res): Promise<void> => {
  const parsed = GetCarsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params", message: parsed.error.message });
    return;
  }

  const {
    brand,
    model,
    body_type,
    fuel_type,
    transmission,
    min_price,
    max_price,
    seating_capacity,
    search,
    page = 1,
    limit = 20,
  } = parsed.data;

  let cars = loadCars();
  const brands = [...new Set(cars.map((c) => c.brand))];
  const models = [...new Set(cars.map((c) => c.model))];

  let correctedQuery: string | undefined;

  if (brand) {
    const matched = fuzzyMatchBrand(brand, brands);
    if (matched) {
      if (matched.toLowerCase() !== brand.toLowerCase()) {
        correctedQuery = matched;
      }
      cars = cars.filter((c) => c.brand.toLowerCase() === matched.toLowerCase());
    } else {
      cars = [];
    }
  }

  if (model) {
    const matched = fuzzyMatchModel(model, models);
    if (matched) {
      cars = cars.filter((c) => c.model.toLowerCase() === matched.toLowerCase());
    } else {
      cars = [];
    }
  }

  if (body_type) {
    cars = cars.filter((c) => c.body_type.toLowerCase() === body_type.toLowerCase());
  }

  if (fuel_type) {
    cars = cars.filter((c) => c.fuel_type.toLowerCase() === fuel_type.toLowerCase());
  }

  if (transmission) {
    cars = cars.filter((c) => c.transmission.toLowerCase() === transmission.toLowerCase());
  }

  if (min_price != null) {
    cars = cars.filter((c) => c.price_lakh >= min_price);
  }

  if (max_price != null) {
    cars = cars.filter((c) => c.price_lakh <= max_price);
  }

  if (seating_capacity != null) {
    cars = cars.filter((c) => c.seating_capacity >= seating_capacity);
  }

  if (search) {
    const q = search.toLowerCase();
    cars = cars.filter(
      (c) =>
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.variant_name.toLowerCase().includes(q) ||
        c.body_type.toLowerCase().includes(q) ||
        c.fuel_type.toLowerCase().includes(q)
    );
  }

  const carsWithScore = cars.map((c) => ({
    ...c,
    score: computeScore(c),
    image_url: getCarImageUrl(c.brand, c.model),
  }));

  const total = carsWithScore.length;
  const offset = (page - 1) * limit;
  const paginated = carsWithScore.slice(offset, offset + limit);

  const response: Record<string, unknown> = {
    cars: paginated,
    total,
    page,
    limit,
  };

  if (correctedQuery) {
    response.corrected_query = correctedQuery;
  }

  res.json(response);
});

router.get("/cars/brands", async (_req, res): Promise<void> => {
  const cars = loadCars();
  const brands = [...new Set(cars.map((c) => c.brand))].sort();
  res.json({ brands });
});

router.get("/cars/stats", async (_req, res): Promise<void> => {
  const cars = loadCars();
  const total_cars = cars.length;
  const total_brands = new Set(cars.map((c) => c.brand)).size;
  const avg_price_lakh = cars.reduce((sum, c) => sum + c.price_lakh, 0) / total_cars;
  const avg_mileage = cars.reduce((sum, c) => sum + c.mileage_kmpl, 0) / total_cars;

  const body_type_counts: Record<string, number> = {};
  const fuel_type_counts: Record<string, number> = {};

  for (const car of cars) {
    body_type_counts[car.body_type] = (body_type_counts[car.body_type] || 0) + 1;
    fuel_type_counts[car.fuel_type] = (fuel_type_counts[car.fuel_type] || 0) + 1;
  }

  const prices = cars.map((c) => c.price_lakh);

  res.json({
    total_cars,
    total_brands,
    avg_price_lakh: Math.round(avg_price_lakh * 10) / 10,
    avg_mileage: Math.round(avg_mileage * 10) / 10,
    body_type_counts,
    fuel_type_counts,
    price_range: {
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
  });
});

router.get("/cars/:carId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.carId) ? req.params.carId[0] : req.params.carId;
  const parsed = GetCarByIdParams.safeParse({ carId: parseInt(rawId, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid car ID" });
    return;
  }

  const cars = loadCars();
  const car = cars.find((c) => c.car_id === parsed.data.carId);

  if (!car) {
    res.status(404).json({ error: "Car not found" });
    return;
  }

  res.json({
    ...car,
    score: computeScore(car),
    image_url: getCarImageUrl(car.brand, car.model),
  });
});

export default router;

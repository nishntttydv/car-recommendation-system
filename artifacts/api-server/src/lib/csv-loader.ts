import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

// The CSV is at artifacts/api-server/src/data/cars.csv
// When bundled with esbuild, __dirname is set via globalThis banner
// When running in dev, __dirname comes from the src/ dir
function getDataPath(): string {
  // Try adjacent to the current file (src/lib/ -> src/data/)
  const currentDir = fileURLToPath(new URL(".", import.meta.url));
  const srcDataPath = join(currentDir, "../data/cars.csv");
  try {
    readFileSync(srcDataPath, { flag: "r" });
    return srcDataPath;
  } catch {
    // We're in dist/, data was copied to dist/data/
    return join(currentDir, "data/cars.csv");
  }
}

export interface CarRow {
  car_id: number;
  brand: string;
  model: string;
  variant_name: string;
  year: number;
  body_type: string;
  fuel_type: string;
  transmission: string;
  price_lakh: number;
  mileage_kmpl: number;
  engine_cc: number;
  seating_capacity: number;
  service_cost_inr: number;
  airbags: number;
  abs: string;
  rear_camera: string;
  touchscreen: string;
  cruise_control: string;
  sunroof: string;
  safety_rating: number;
  brand_image_score: number;
  sentiment_score: number;
  headlight_inr: number;
  backlight_inr: number;
  front_bumper_inr: number;
  rear_bumper_inr: number;
  side_mirror_inr: number;
  score?: number;
  image_url?: string;
}

let carsCache: CarRow[] | null = null;

export function loadCars(): CarRow[] {
  if (carsCache) return carsCache;

  const csvPath = getDataPath();
  const content = readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  const cars: CarRow[] = lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] ?? "").trim();
    });

    return {
      car_id: parseInt(row.Car_ID) || 0,
      brand: row.Brand || "",
      model: row.Model || "",
      variant_name: row.Variant_Name || "",
      year: parseInt(row.Year) || 2024,
      body_type: row.Body_Type || "",
      fuel_type: row.Fuel_Type || "",
      transmission: row.Transmission || "",
      price_lakh: parseFloat(row.Price_Lakh) || 0,
      mileage_kmpl: parseFloat(row.Mileage_kmpl) || 0,
      engine_cc: parseInt(row.Engine_CC) || 0,
      seating_capacity: parseInt(row.Seating_Capacity) || 5,
      service_cost_inr: parseInt(row.Service_Cost_INR) || 0,
      airbags: parseInt(row.Airbags) || 0,
      abs: row.ABS || "No",
      rear_camera: row.Rear_Camera || "No",
      touchscreen: row.Touchscreen || "No",
      cruise_control: row.Cruise_Control || "No",
      sunroof: row.Sunroof || "No",
      safety_rating: parseInt(row.Safety_Rating) || 0,
      brand_image_score: parseFloat(row.Brand_Image_Score) || 0,
      sentiment_score: parseFloat(row.Sentiment_Score) || 0,
      headlight_inr: parseInt(row.Headlight_INR) || 0,
      backlight_inr: parseInt(row.Backlight_INR) || 0,
      front_bumper_inr: parseInt(row.FrontBumper_INR) || 0,
      rear_bumper_inr: parseInt(row.RearBumper_INR) || 0,
      side_mirror_inr: parseInt(row.SideMirror_INR) || 0,
    };
  });

  carsCache = cars;
  return cars;
}

export function computeScore(car: CarRow): number {
  const cars = loadCars();

  const maxPrice = Math.max(...cars.map((c) => c.price_lakh));
  const maxMileage = Math.max(...cars.map((c) => c.mileage_kmpl));
  const maxSafety = Math.max(...cars.map((c) => c.safety_rating));
  const maxServiceCost = Math.max(...cars.map((c) => c.service_cost_inr));
  const maxSentiment = Math.max(...cars.map((c) => c.sentiment_score));
  const maxBrandImage = Math.max(...cars.map((c) => c.brand_image_score));

  const priceScore = maxPrice > 0 ? (maxPrice - car.price_lakh) / maxPrice : 0;
  const mileageScore = maxMileage > 0 ? car.mileage_kmpl / maxMileage : 0;
  const safetyScore = maxSafety > 0 ? car.safety_rating / maxSafety : 0;
  const serviceCostScore = maxServiceCost > 0 ? (maxServiceCost - car.service_cost_inr) / maxServiceCost : 0;
  const sentimentScore = maxSentiment > 0 ? car.sentiment_score / maxSentiment : 0;
  const brandScore = maxBrandImage > 0 ? car.brand_image_score / maxBrandImage : 0;

  const featureScore =
    ([car.abs, car.rear_camera, car.touchscreen, car.cruise_control, car.sunroof].filter((f) => f === "Yes").length) / 5;

  return (
    0.2 * priceScore +
    0.15 * mileageScore +
    0.15 * safetyScore +
    0.1 * featureScore +
    0.1 * serviceCostScore +
    0.2 * sentimentScore +
    0.1 * brandScore
  );
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

export function fuzzyMatchBrand(input: string, brands: string[]): string | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();

  const exactMatch = brands.find((b) => b.toLowerCase() === normalized);
  if (exactMatch) return exactMatch;

  let bestMatch: string | null = null;
  let bestScore = Infinity;

  for (const brand of brands) {
    const dist = levenshteinDistance(normalized, brand.toLowerCase());
    const threshold = Math.max(2, Math.floor(brand.length * 0.35));
    if (dist < bestScore && dist <= threshold) {
      bestScore = dist;
      bestMatch = brand;
    }
  }

  return bestMatch;
}

export function fuzzyMatchModel(input: string, models: string[]): string | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();

  const exactMatch = models.find((m) => m.toLowerCase() === normalized);
  if (exactMatch) return exactMatch;

  let bestMatch: string | null = null;
  let bestScore = Infinity;

  for (const model of models) {
    const dist = levenshteinDistance(normalized, model.toLowerCase());
    const threshold = Math.max(2, Math.floor(model.length * 0.4));
    if (dist < bestScore && dist <= threshold) {
      bestScore = dist;
      bestMatch = model;
    }
  }

  return bestMatch;
}

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

const CSV_HEADERS = [
  "Car_ID",
  "Brand",
  "Model",
  "Variant_Name",
  "Year",
  "Body_Type",
  "Fuel_Type",
  "Transmission",
  "Price_Lakh",
  "Mileage_kmpl",
  "Engine_CC",
  "Seating_Capacity",
  "Service_Cost_INR",
  "Airbags",
  "ABS",
  "Rear_Camera",
  "Touchscreen",
  "Cruise_Control",
  "Sunroof",
  "Safety_Rating",
  "Brand_Image_Score",
  "Sentiment_Score",
  "Headlight_INR",
  "Backlight_INR",
  "FrontBumper_INR",
  "RearBumper_INR",
  "SideMirror_INR",
] as const;

const VALID_BODY_TYPES = new Set(["Hatchback", "Sedan", "SUV", "MPV", "Coupe", "Convertible", "Pickup", "Wagon"]);
const VALID_FUEL_TYPES = new Set(["Petrol", "Diesel", "Electric", "CNG", "Hybrid"]);
const VALID_TRANSMISSIONS = new Set(["Manual", "Automatic"]);
const VALID_BOOLEAN_TEXT = new Set(["Yes", "No"]);

type CsvHeader = typeof CSV_HEADERS[number];

function parseCsvRecords(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentField += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i++;
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function toRowObject(values: string[]): Record<CsvHeader, string> {
  const row = {} as Record<CsvHeader, string>;
  CSV_HEADERS.forEach((header, index) => {
    row[header] = (values[index] ?? "").trim();
  });
  return row;
}

function normalizeHeaderCount(values: string[]): string[] {
  if (values.length === CSV_HEADERS.length) return values;

  if (values.length > CSV_HEADERS.length) {
    const fixedVariant = values.slice(3, values.length - (CSV_HEADERS.length - 4)).join(", ");
    return [
      values[0] ?? "",
      values[1] ?? "",
      values[2] ?? "",
      fixedVariant,
      ...values.slice(values.length - (CSV_HEADERS.length - 4)),
    ];
  }

  return values;
}

function repairMissingModelVariantSplit(
  values: string[],
  knownModelsByBrand: Map<string, Set<string>>,
): string[] | null {
  if (values.length !== CSV_HEADERS.length - 1) return null;

  const brand = (values[1] ?? "").trim();
  const combinedModelVariant = (values[2] ?? "").trim();
  const trailingFields = values.slice(3);
  const knownModels = [...(knownModelsByBrand.get(brand) ?? new Set<string>())]
    .sort((a, b) => b.length - a.length);

  for (const model of knownModels) {
    if (!combinedModelVariant.toLowerCase().startsWith(model.toLowerCase())) continue;

    const variant = combinedModelVariant.slice(model.length).trim();
    if (!variant) continue;

    return [
      values[0] ?? "",
      brand,
      model,
      variant,
      ...trailingFields,
    ];
  }

  const parts = combinedModelVariant.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const inferredModel = parts.slice(0, Math.max(1, Math.ceil(parts.length / 2) - 1)).join(" ");
    const inferredVariant = parts.slice(Math.max(1, Math.ceil(parts.length / 2) - 1)).join(" ");
    return [
      values[0] ?? "",
      brand,
      inferredModel,
      inferredVariant,
      ...trailingFields,
    ];
  }

  return null;
}

function asInt(value: string, fallback = 0): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asFloat(value: string, fallback = 0): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function looksPlausibleRawRow(row: Record<CsvHeader, string>): boolean {
  return (
    /^\d+$/.test(row.Car_ID) &&
    /^\d{4}$/.test(row.Year) &&
    VALID_BODY_TYPES.has(row.Body_Type) &&
    VALID_FUEL_TYPES.has(row.Fuel_Type) &&
    VALID_TRANSMISSIONS.has(row.Transmission)
  );
}

function parseCarRow(row: Record<CsvHeader, string>): CarRow {
  return {
    car_id: asInt(row.Car_ID),
    brand: row.Brand || "",
    model: row.Model || "",
    variant_name: row.Variant_Name || "",
    year: asInt(row.Year, 2024),
    body_type: row.Body_Type || "",
    fuel_type: row.Fuel_Type || "",
    transmission: row.Transmission || "",
    price_lakh: asFloat(row.Price_Lakh),
    mileage_kmpl: asFloat(row.Mileage_kmpl),
    engine_cc: asInt(row.Engine_CC),
    seating_capacity: asInt(row.Seating_Capacity, 5),
    service_cost_inr: asInt(row.Service_Cost_INR),
    airbags: asInt(row.Airbags),
    abs: row.ABS || "No",
    rear_camera: row.Rear_Camera || "No",
    touchscreen: row.Touchscreen || "No",
    cruise_control: row.Cruise_Control || "No",
    sunroof: row.Sunroof || "No",
    safety_rating: asInt(row.Safety_Rating),
    brand_image_score: asFloat(row.Brand_Image_Score),
    sentiment_score: asFloat(row.Sentiment_Score),
    headlight_inr: asInt(row.Headlight_INR),
    backlight_inr: asInt(row.Backlight_INR),
    front_bumper_inr: asInt(row.FrontBumper_INR),
    rear_bumper_inr: asInt(row.RearBumper_INR),
    side_mirror_inr: asInt(row.SideMirror_INR),
  };
}

function isPlausibleCarRow(car: CarRow): boolean {
  const positiveRepairCost = [car.headlight_inr, car.backlight_inr, car.front_bumper_inr, car.rear_bumper_inr, car.side_mirror_inr];
  return (
    car.car_id > 0 &&
    car.brand.length > 0 &&
    car.model.length > 0 &&
    car.year >= 2010 &&
    car.year <= 2035 &&
    VALID_BODY_TYPES.has(car.body_type) &&
    VALID_FUEL_TYPES.has(car.fuel_type) &&
    VALID_TRANSMISSIONS.has(car.transmission) &&
    car.price_lakh >= 2 &&
    car.price_lakh <= 100 &&
    car.mileage_kmpl >= 0 &&
    car.mileage_kmpl <= 60 &&
    car.engine_cc >= 0 &&
    car.engine_cc <= 7000 &&
    car.seating_capacity >= 2 &&
    car.seating_capacity <= 9 &&
    car.service_cost_inr >= 0 &&
    car.service_cost_inr <= 50000 &&
    car.airbags >= 0 &&
    car.airbags <= 12 &&
    VALID_BOOLEAN_TEXT.has(car.abs) &&
    VALID_BOOLEAN_TEXT.has(car.rear_camera) &&
    VALID_BOOLEAN_TEXT.has(car.touchscreen) &&
    VALID_BOOLEAN_TEXT.has(car.cruise_control) &&
    VALID_BOOLEAN_TEXT.has(car.sunroof) &&
    car.safety_rating >= 0 &&
    car.safety_rating <= 5 &&
    car.brand_image_score >= 0 &&
    car.brand_image_score <= 10 &&
    car.sentiment_score >= 0 &&
    car.sentiment_score <= 1 &&
    positiveRepairCost.every((value) => value >= 0 && value <= 200000)
  );
}

export function loadCars(): CarRow[] {
  if (carsCache) return carsCache;

  const csvPath = getDataPath();
  const content = readFileSync(csvPath, "utf-8");
  const records = parseCsvRecords(content);
  const dataRows = records.slice(1);
  const knownModelsByBrand = new Map<string, Set<string>>();
  const cars: CarRow[] = [];

  for (const rawValues of dataRows) {
    let values = normalizeHeaderCount(rawValues);
    let row = values.length === CSV_HEADERS.length ? toRowObject(values) : null;

    if (!row || !looksPlausibleRawRow(row)) {
      const repaired = repairMissingModelVariantSplit(values, knownModelsByBrand);
      if (repaired) {
        values = repaired;
        row = toRowObject(values);
      }
    }

    if (!row || !looksPlausibleRawRow(row)) continue;

    const car = parseCarRow(row);
    if (!isPlausibleCarRow(car)) continue;

    cars.push(car);

    const modelsForBrand = knownModelsByBrand.get(car.brand) ?? new Set<string>();
    modelsForBrand.add(car.model);
    knownModelsByBrand.set(car.brand, modelsForBrand);
  }

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

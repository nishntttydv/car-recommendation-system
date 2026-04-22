/**
 * Smart local search fallback with:
 * - Partial/prefix matching
 * - Levenshtein fuzzy matching for typos
 * - Feature keyword detection
 * - Slang and alias resolution
 * - Hindi/Hinglish keyword support
 */

export interface SmartFilters {
  brand?: string;
  model?: string;
  body_type?: string;
  fuel_type?: string;
  transmission?: string;
  budget_max?: number;
  budget_min?: number;
  seating_capacity?: number;
  feature_sunroof?: boolean;
  feature_abs?: boolean;
  feature_touchscreen?: boolean;
  feature_cruise_control?: boolean;
  feature_rear_camera?: boolean;
  safety_min?: number;
  family_friendly?: boolean;
  comfort_priority?: boolean;
  fun_to_drive?: boolean;
  city_friendly?: boolean;
  highway_friendly?: boolean;
  low_maintenance?: boolean;
  rough_road_ready?: boolean;
  premium_preference?: boolean;
  mileage_priority?: boolean;
  first_car?: boolean;
}

// Brand aliases (handles slang, misspellings, partial names)
const BRAND_ALIASES: Record<string, string> = {
  maruti: "Maruti Suzuki",
  "maruti suzuki": "Maruti Suzuki",
  maruthi: "Maruti Suzuki",
  suzuki: "Maruti Suzuki",
  hyundai: "Hyundai",
  hyndai: "Hyundai",
  hyundia: "Hyundai",
  hundai: "Hyundai",
  tata: "Tata Motors",
  "tata motors": "Tata Motors",
  honda: "Honda",
  toyota: "Toyota",
  toyta: "Toyota",
  toyata: "Toyota",
  kia: "Kia",
  mahindra: "Mahindra",
  mahendra: "Mahindra",
  "m&m": "Mahindra",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  skoda: "Skoda",
  renault: "Renault",
  nissan: "Nissan",
  mg: "MG",
  "mg motors": "MG",
  jeep: "Jeep",
  ford: "Ford",
  bmw: "BMW",
  mercedes: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  merc: "Mercedes-Benz",
  audi: "Audi",
  lexus: "Lexus",
  byd: "BYD",
  tesla: "Tesla",
  citroen: "Citroen",
  citroën: "Citroen",
  volvo: "Volvo",
  land: "Land Rover",
  "land rover": "Land Rover",
  jaguar: "Jaguar",
  isuzu: "Isuzu",
};

// Fuel type aliases
const FUEL_ALIASES: Record<string, string> = {
  petrol: "Petrol",
  gasoline: "Petrol",
  gas: "Petrol",
  "petrol engine": "Petrol",
  diesel: "Diesel",
  "diesel engine": "Diesel",
  electric: "Electric",
  ev: "Electric",
  "electric car": "Electric",
  "bijli ki gaadi": "Electric",
  "electric vehicle": "Electric",
  battery: "Electric",
  cng: "CNG",
  "compressed natural gas": "CNG",
  hybrid: "Hybrid",
  "mild hybrid": "Hybrid",
  "full hybrid": "Hybrid",
};

// Body type aliases
const BODY_ALIASES: Record<string, string> = {
  suv: "SUV",
  "sport utility": "SUV",
  crossover: "SUV",
  hatchback: "Hatchback",
  hatch: "Hatchback",
  "small car": "Hatchback",
  sedan: "Sedan",
  saloon: "Sedan",
  mpv: "MPV",
  "multi purpose": "MPV",
  minivan: "MPV",
  van: "MPV",
  "7 seater car": "MPV",
};

// Transmission aliases
const TRANSMISSION_ALIASES: Record<string, string> = {
  automatic: "Automatic",
  auto: "Automatic",
  automati: "Automatic",
  "auto gear": "Automatic",
  at: "Automatic",
  amt: "Automatic",
  cvt: "Automatic",
  dct: "Automatic",
  "self drive": "Automatic",
  manual: "Manual",
  manul: "Manual",
  mnual: "Manual",
  mt: "Manual",
  "gear": "Manual",
  stick: "Manual",
};

// Feature keyword patterns
const FEATURE_PATTERNS: Array<{ patterns: string[]; filter: keyof SmartFilters }> = [
  { patterns: ["sunroof", "sunroo", "sun roof", "sanroof", "sunruf", "panoramic", "moonroof"], filter: "feature_sunroof" },
  { patterns: ["abs", "anti lock", "antilock", "anti-lock", "brakes"], filter: "feature_abs" },
  { patterns: ["touchscreen", "touch screen", "infotainment", "screen", "display", "apple carplay", "android auto"], filter: "feature_touchscreen" },
  { patterns: ["cruise control", "cruise", "cruize", "cruise contrl", "adaptive cruise"], filter: "feature_cruise_control" },
  { patterns: ["rear camera", "reverse camera", "backup camera", "parking camera", "camera", "reversing cam"], filter: "feature_rear_camera" },
];

// Hindi/Hinglish term mappings
const HINDI_MAPPINGS: Array<{ patterns: string[]; action: (f: SmartFilters) => void }> = [
  { patterns: ["sasta", "budget", "affordable", "cheap", "economy", "economic", "kam budget"], action: (f) => { f.budget_max = 8; } },
  { patterns: ["mehanga", "luxury", "premium", "high end", "costly", "expensive"], action: (f) => { f.budget_min = 20; } },
  { patterns: ["family", "parivar", "family car", "family gaadi", "ghar ke liye", "baccho ke liye", "7 seater", "7seater", "saat seat", "7seat"], action: (f) => { f.family_friendly = true; if (!f.seating_capacity) f.seating_capacity = 5; } },
  { patterns: ["safe", "safety", "suraksha", "5 star", "5star", "ncap"], action: (f) => { f.safety_min = 4; } },
  { patterns: ["first car", "pehli gaadi", "new driver", "beginner", "seekhne ke liye", "new learner"], action: (f) => { f.first_car = true; if (!f.transmission) f.transmission = "Automatic"; } },
];

const INTENT_MAPPINGS: Array<{ patterns: string[]; action: (f: SmartFilters) => void }> = [
  {
    patterns: [
      "comfortable", "comfort", "comfy", "aaramdayak", "aaraamdayak", "aaram", "smooth",
      "soft suspension", "relaxed", "family comfort", "long drive comfort", "thakaan kam",
    ],
    action: (f) => { f.comfort_priority = true; },
  },
  {
    patterns: [
      "fun to drive", "mazedar", "mazeddar", "majedar", "mast", "jhakkas", "dhasu",
      "chalane mein maza", "chalne wali gadi", "driver car", "enthusiast", "sporty",
      "performance", "quick", "pickup achha", "powerful", "tez", "fast", "punchy",
    ],
    action: (f) => { f.fun_to_drive = true; },
  },
  {
    patterns: [
      "city", "city drive", "daily commute", "daily use", "office jaane", "traffic", "bheed",
      "compact", "parking easy", "easy to drive", "choti gadi", "urban",
    ],
    action: (f) => { f.city_friendly = true; },
  },
  {
    patterns: [
      "highway", "long drive", "touring", "road trip", "expressway", "stable", "high speed",
      "cruise", "long route",
    ],
    action: (f) => { f.highway_friendly = true; },
  },
  {
    patterns: [
      "maintenance kam", "kam maintenance", "maintenance bhi kam", "low maintenance",
      "reliable", "bharosemand", "tension free", "service sasta", "service bhi sasta",
      "parts cheap", "maintenance cheap", "ownership cost low", "pocket friendly maintenance",
    ],
    action: (f) => { f.low_maintenance = true; },
  },
  {
    patterns: [
      "bad road", "rough road", "gaon", "village road", "ground clearance", "kharab road",
      "speed breaker", "pothole", "tooti sadak", "off road", "offroad",
    ],
    action: (f) => { f.rough_road_ready = true; if (!f.body_type) f.body_type = "SUV"; },
  },
  {
    patterns: [
      "premium", "luxury", "mehangi", "mehangi wali", "top model", "rich feel", "posh",
    ],
    action: (f) => { f.premium_preference = true; if (!f.budget_min) f.budget_min = 15; },
  },
  {
    patterns: [
      "mileage", "milage", "milege", "fuel efficient", "fuel efficiency", "kam kharch",
      "petrol bachaye", "zyada mileage", "running cost kam", "economical running",
    ],
    action: (f) => { f.mileage_priority = true; },
  },
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForCompare(s: string): string {
  return normalizeToken(s).replace(/\s+/g, "");
}

/** Resolve a partial/fuzzy input against a list of known values */
function fuzzyResolve(input: string, known: string[]): string | null {
  const inp = normalizeToken(input);
  if (!inp) return null;

  // Exact match
  for (const k of known) if (normalizeToken(k) === inp) return k;

  // Prefix match (user typed start of word)
  for (const k of known) {
    const norm = normalizeToken(k);
    if (norm.startsWith(inp) && inp.length >= 3) return k;
    if (inp.startsWith(norm) && norm.length >= 3) return k;
  }

  // Fuzzy (Levenshtein) — only if input is at least 3 chars
  if (inp.length >= 3) {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const k of known) {
      const norm = normalizeToken(k);
      const dist = levenshtein(inp, norm);
      const threshold = Math.max(2, Math.floor(inp.length * 0.35));
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        best = k;
      }
    }
    if (best) return best;
  }

  return null;
}

/**
 * Build smart filters from a raw text query using only local logic
 * (no external API calls). Used as Gemini fallback or augmentation.
 */
export function buildSmartFilters(query: string): SmartFilters {
  const filters: SmartFilters = {};
  const q = normalizeToken(query);

  // --- Budget patterns ---
  const budgetUnder = q.match(/(?:under|below|less than|max|upto|up to|within)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|l\b)/i);
  const budgetAbove = q.match(/(?:above|over|more than|min|minimum|atleast|at least)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|l\b)/i);
  const budgetBetween = q.match(/(?:between|from)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|l)?\s*(?:to|and|-)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|l\b)/i);
  const budgetRaw = q.match(/(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|l)\s*(?:budget|price|car)?/i);

  if (budgetBetween) {
    filters.budget_min = parseFloat(budgetBetween[1]);
    filters.budget_max = parseFloat(budgetBetween[2]);
  } else if (budgetUnder) {
    filters.budget_max = parseFloat(budgetUnder[1]);
  } else if (budgetAbove) {
    filters.budget_min = parseFloat(budgetAbove[1]);
  } else if (budgetRaw) {
    filters.budget_max = parseFloat(budgetRaw[1]);
  }

  // --- Seating patterns ---
  const seatingMatch = q.match(/(\d)\s*(?:-\s*)?seater/i) || q.match(/(\d)\s*seat/i);
  if (seatingMatch) filters.seating_capacity = parseInt(seatingMatch[1]);

  // --- Brand aliases ---
  for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
    if (q.includes(alias.toLowerCase())) {
      filters.brand = brand;
      break;
    }
  }

  // --- Fuel aliases ---
  for (const [alias, fuel] of Object.entries(FUEL_ALIASES)) {
    if (q.includes(alias.toLowerCase())) {
      filters.fuel_type = fuel;
      break;
    }
  }

  // --- Body type aliases ---
  for (const [alias, body] of Object.entries(BODY_ALIASES)) {
    if (q.includes(alias.toLowerCase())) {
      filters.body_type = body;
      break;
    }
  }

  // --- Transmission aliases ---
  for (const [alias, tx] of Object.entries(TRANSMISSION_ALIASES)) {
    if (q.split(/\s+/).some((w) => normalizeToken(w) === alias) || q.includes(alias)) {
      filters.transmission = tx;
      break;
    }
  }

  // --- Feature patterns ---
  for (const { patterns, filter } of FEATURE_PATTERNS) {
    if (patterns.some((p) => q.includes(p))) {
      (filters as Record<string, boolean>)[filter as string] = true;
    }
  }

  // --- Hindi/contextual mappings ---
  for (const { patterns, action } of HINDI_MAPPINGS) {
    if (patterns.some((p) => q.includes(p))) {
      action(filters);
    }
  }

  // --- Broader intent mappings ---
  for (const { patterns, action } of INTENT_MAPPINGS) {
    if (patterns.some((p) => q.includes(normalizeToken(p)))) {
      action(filters);
    }
  }

  // Family implies comfort unless user explicitly asks for sporty feel
  if (filters.family_friendly && !filters.fun_to_drive) {
    filters.comfort_priority = true;
  }

  return filters;
}

/**
 * Apply SmartFilters to a car array. Handles feature booleans, safety_min etc.
 */
export function applySmartFilters(
  cars: Array<Record<string, unknown>>,
  filters: SmartFilters
): Array<Record<string, unknown>> {
  return cars.filter((car) => {
    if (filters.brand && (car.brand as string).toLowerCase() !== filters.brand.toLowerCase()) return false;
    if (filters.model && (car.model as string).toLowerCase() !== filters.model.toLowerCase()) return false;
    if (filters.body_type && (car.body_type as string).toLowerCase() !== filters.body_type.toLowerCase()) return false;
    if (filters.fuel_type && (car.fuel_type as string).toLowerCase() !== filters.fuel_type.toLowerCase()) return false;
    if (filters.transmission && (car.transmission as string).toLowerCase() !== filters.transmission.toLowerCase()) return false;
    if (filters.budget_max != null && (car.price_lakh as number) > filters.budget_max) return false;
    if (filters.budget_min != null && (car.price_lakh as number) < filters.budget_min) return false;
    if (filters.seating_capacity != null && (car.seating_capacity as number) < filters.seating_capacity) return false;
    if (filters.feature_sunroof && (car.sunroof as string) !== "Yes") return false;
    if (filters.feature_abs && (car.abs as string) !== "Yes") return false;
    if (filters.feature_touchscreen && (car.touchscreen as string) !== "Yes") return false;
    if (filters.feature_cruise_control && (car.cruise_control as string) !== "Yes") return false;
    if (filters.feature_rear_camera && (car.rear_camera as string) !== "Yes") return false;
    if (filters.safety_min != null && (car.safety_rating as number) < filters.safety_min) return false;
    return true;
  });
}

/**
 * Full-text fuzzy search over brand, model, variant, body_type, fuel_type.
 * Each token in the query must match at least one field (substring or Levenshtein).
 */
export function fuzzyTextSearch(
  cars: Array<Record<string, unknown>>,
  query: string
): Array<Record<string, unknown>> {
  const tokens = normalizeToken(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (tokens.length === 0) return cars;

  return cars.filter((car) => {
    const searchable = [
      car.brand,
      car.model,
      car.variant_name,
      car.body_type,
      car.fuel_type,
      car.transmission,
    ]
      .map((v) => normalizeToken(String(v)))
      .join(" ");

    return tokens.every((token) => {
      if (searchable.includes(token)) return true;
      // Check each word for fuzzy match
      const words = searchable.split(/\s+/);
      return words.some((w) => {
        if (w.startsWith(token) && token.length >= 3) return true;
        if (token.length >= 4 && levenshtein(token, w) <= 2) return true;
        return false;
      });
    });
  });
}

function safeNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function yes(v: unknown): boolean {
  return String(v).toLowerCase() === "yes";
}

function hasKnownValue<T extends string>(value: string, allowed: T[]): boolean {
  return allowed.includes(value as T);
}

function scoreDataQuality(car: Record<string, unknown>): number {
  let score = 0;

  const bodyType = String(car.body_type ?? "");
  const fuelType = String(car.fuel_type ?? "");
  const transmission = String(car.transmission ?? "");
  const seating = safeNumber(car.seating_capacity);
  const price = safeNumber(car.price_lakh);
  const mileage = safeNumber(car.mileage_kmpl);
  const safety = safeNumber(car.safety_rating);
  const service = safeNumber(car.service_cost_inr);
  const sentiment = safeNumber(car.sentiment_score);

  if (hasKnownValue(bodyType, ["Hatchback", "Sedan", "SUV", "MPV", "Coupe", "Convertible", "Pickup", "Wagon"])) score += 2;
  else score -= 10;

  if (hasKnownValue(fuelType, ["Petrol", "Diesel", "Electric", "CNG", "Hybrid"])) score += 2;
  else score -= 10;

  if (hasKnownValue(transmission, ["Manual", "Automatic"])) score += 2;
  else score -= 10;

  if (seating >= 2 && seating <= 9) score += 2;
  else score -= 12;

  if (price >= 2 && price <= 100) score += 2;
  else score -= 8;

  if (mileage >= 0 && mileage <= 60) score += 1;
  else score -= 6;

  if (safety >= 0 && safety <= 5) score += 1;
  else score -= 6;

  if (service >= 0 && service <= 50000) score += 1;
  else score -= 6;

  if (sentiment >= 0 && sentiment <= 1) score += 1;
  else score -= 6;

  return score;
}

export function scoreSmartMatch(
  car: Record<string, unknown>,
  filters: SmartFilters,
  rawQuery: string,
): number {
  let score = scoreDataQuality(car);

  const searchable = [
    car.brand,
    car.model,
    car.variant_name,
    car.body_type,
    car.fuel_type,
    car.transmission,
  ]
    .map((v) => normalizeToken(String(v)))
    .join(" ");

  const compactSearchable = normalizeForCompare(searchable);
  const tokens = normalizeToken(rawQuery).split(/\s+/).filter((t) => t.length >= 2);

  for (const token of tokens) {
    const compactToken = normalizeForCompare(token);
    if (searchable.includes(token)) score += 5;
    else if (compactToken && compactSearchable.includes(compactToken)) score += 4;
  }

  const bodyType = String(car.body_type ?? "");
  const fuelType = String(car.fuel_type ?? "");
  const transmission = String(car.transmission ?? "");
  const seating = safeNumber(car.seating_capacity);
  const mileage = safeNumber(car.mileage_kmpl);
  const service = safeNumber(car.service_cost_inr, 999999);
  const safety = safeNumber(car.safety_rating);
  const engine = safeNumber(car.engine_cc);
  const price = safeNumber(car.price_lakh);
  const sentiment = safeNumber(car.sentiment_score);
  const brandScore = safeNumber(car.brand_image_score);

  if (filters.family_friendly) {
    if (seating >= 7) score += 12;
    else if (seating >= 5) score += 7;
    if (bodyType === "SUV" || bodyType === "MPV") score += 6;
    if (safety >= 4) score += 5;
    if (yes(car.rear_camera)) score += 2;
  }

  if (filters.comfort_priority) {
    if (bodyType === "SUV" || bodyType === "Sedan" || bodyType === "MPV") score += 5;
    if (transmission === "Automatic") score += 4;
    if (yes(car.cruise_control)) score += 3;
    if (yes(car.sunroof)) score += 1;
    if (seating >= 5) score += 2;
  }

  if (filters.fun_to_drive) {
    if (engine >= 1400) score += 6;
    if (bodyType === "Sedan" || bodyType === "SUV") score += 3;
    if (transmission === "Automatic") score += 2;
    if (brandScore >= 8) score += 2;
    if (sentiment >= 0.8) score += 2;
  }

  if (filters.city_friendly) {
    if (bodyType === "Hatchback") score += 8;
    if (bodyType === "Sedan") score += 3;
    if (price <= 12) score += 4;
    if (transmission === "Automatic") score += 3;
    if (service <= 7000) score += 4;
  }

  if (filters.highway_friendly) {
    if (bodyType === "SUV" || bodyType === "Sedan") score += 5;
    if (transmission === "Automatic") score += 3;
    if (yes(car.cruise_control)) score += 4;
    if (safety >= 4) score += 4;
    if (engine >= 1400 || fuelType === "Electric") score += 3;
  }

  if (filters.low_maintenance) {
    if (service <= 6000) score += 8;
    else if (service <= 9000) score += 4;
    if (price <= 15) score += 3;
    if (brandScore >= 7) score += 2;
  }

  if (filters.rough_road_ready) {
    if (bodyType === "SUV") score += 10;
    if (seating >= 5) score += 2;
  }

  if (filters.premium_preference) {
    if (price >= 20) score += 6;
    if (brandScore >= 8) score += 4;
    if (yes(car.sunroof)) score += 2;
    if (yes(car.touchscreen)) score += 2;
  }

  if (filters.mileage_priority) {
    if (fuelType === "Electric") score += 8;
    else if (fuelType === "CNG") score += 7;
    else if (fuelType === "Hybrid") score += 6;
    else score += Math.min(6, mileage / 5);
  }

  if (filters.first_car) {
    if (price <= 12) score += 6;
    if (transmission === "Automatic") score += 4;
    if (bodyType === "Hatchback" || bodyType === "Sedan") score += 3;
    if (safety >= 4) score += 3;
    if (service <= 7000) score += 3;
  }

  return score;
}

export { fuzzyResolve };

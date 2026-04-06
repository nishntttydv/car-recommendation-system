import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

if (!apiKey) {
  throw new Error("GOOGLE_API_KEY or AI_INTEGRATIONS_GEMINI_API_KEY must be set");
}

export const ai = new GoogleGenAI({
  apiKey,
  ...(baseUrl
    ? { httpOptions: { apiVersion: "", baseUrl } }
    : {}),
});

export interface ParsedFilters {
  brand?: string;
  model?: string;
  body_type?: string;
  fuel_type?: string;
  transmission?: string;
  budget_max?: number;
  budget_min?: number;
  seating_capacity?: number;
  features?: string[];
}

export async function processCarQuery(query: string): Promise<{
  corrected_query: string;
  filters: ParsedFilters;
  intent: string;
}> {
  const prompt = `You are an expert car search assistant for the Indian automobile market. You understand English, Hindi, Hinglish, and common automotive slang.

User query: "${query}"

Your tasks:
1. Correct ANY spelling mistakes, slang, partial words, or typos:
   - "hyndai"/"hyundai"/"hyundia" → "Hyundai"
   - "toyta"/"toyata" → "Toyota"  
   - "maruthi"/"maruti suzuki"/"maruti" → "Maruti Suzuki"
   - "mahendra"/"mahindra" → "Mahindra"
   - "sunroo"/"sanroof"/"sunruf" → sunroof feature
   - "automtc"/"auto"/"atmt"/"automati" → Automatic transmission
   - "manul"/"mnual" → Manual transmission
   - "kya chahiye" → Hindi for "what do I want"
   - "gaadi"/"gadi" → car
   - "sasta"/"cheap"/"budget" → budget/economy
   - "mehanga"/"expensive"/"luxury" → premium
   - "mileage"/"fuel efficiency"/"milage"/"milege" → mileage priority
   - "7 seater"/"7seater"/"saat seater"/"family car" → seating_capacity 7
   - "EV"/"bijli ki gaadi"/"electric" → Electric fuel
   - "diesel"/"petrol"/"CNG"/"gas" → respective fuel_type
   - "SUV"/"hatchback"/"sedan"/"MPV"/"crossover" → body_type

2. Extract structured filters from the query.

Return ONLY valid JSON with no extra text or markdown:
{
  "corrected_query": "corrected/translated version of query",
  "intent": "brief description of what user wants",
  "brand": "exact brand name or null (Maruti Suzuki/Hyundai/Tata Motors/Honda/Toyota/Kia/Mahindra/Volkswagen/Skoda/Renault/Nissan/MG/Jeep/Ford/BMW/Mercedes-Benz/Audi/Lexus/BYD/Tesla etc.)",
  "model": "model name or null",
  "body_type": "SUV/Sedan/Hatchback/MPV or null",
  "fuel_type": "Petrol/Diesel/Electric/CNG/Hybrid or null",
  "transmission": "Manual/Automatic ONLY if the user explicitly says the word manual or automatic or gearbox type — null otherwise",
  "budget_max": max budget in lakh as number or null,
  "budget_min": min budget in lakh as number or null,
  "seating_capacity": minimum seats as number or null,
  "features": array of strings from ["sunroof","abs","touchscreen","cruise_control","rear_camera"] if explicitly requested, else []
}

Rules:
- For "under X lakh" → budget_max = X
- For "above X lakh"/"more than X lakh" → budget_min = X
- For "between X and Y lakh" → budget_min = X, budget_max = Y
- For partial brand names always resolve to the full brand name
- "gadi" or "car" alone has no brand/model
- If user asks about a feature like "sunroof" or "camera" add it to features array`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "{}";
    const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    const filters: ParsedFilters = {};
    if (parsed.brand) filters.brand = parsed.brand;
    if (parsed.model) filters.model = parsed.model;
    if (parsed.body_type) filters.body_type = parsed.body_type;
    if (parsed.fuel_type) filters.fuel_type = parsed.fuel_type;
    if (parsed.transmission) filters.transmission = parsed.transmission;
    if (parsed.budget_max != null) filters.budget_max = Number(parsed.budget_max);
    if (parsed.budget_min != null) filters.budget_min = Number(parsed.budget_min);
    if (parsed.seating_capacity != null) filters.seating_capacity = Number(parsed.seating_capacity);
    if (parsed.features?.length) filters.features = parsed.features;

    return {
      corrected_query: parsed.corrected_query || query,
      filters,
      intent: parsed.intent || "",
    };
  } catch (e) {
    console.error("[Gemini] processCarQuery error:", e);
    return { corrected_query: query, filters: {}, intent: "" };
  }
}

export async function generateCarInsights(car: {
  brand: string;
  model: string;
  variant_name: string;
  price_lakh: number;
  mileage_kmpl: number;
  safety_rating: number;
  sentiment_score: number;
  brand_image_score: number;
  service_cost_inr: number;
  abs: string;
  sunroof: string;
  cruise_control: string;
  fuel_type: string;
  seating_capacity: number;
}): Promise<{
  why_recommended: string;
  strengths: string[];
  weaknesses: string[];
  best_for: string;
  value_score: number;
}> {
  const prompt = `You are an expert Indian automotive analyst. Analyze this car and return concise, data-backed insights for Indian buyers.

Car: ${car.brand} ${car.model} ${car.variant_name}
Price: ₹${car.price_lakh} lakh
Mileage: ${car.mileage_kmpl > 0 ? `${car.mileage_kmpl} km/l` : "Electric vehicle"}
Fuel: ${car.fuel_type}
Safety Rating: ${car.safety_rating}/5 stars
Sentiment Score: ${(car.sentiment_score * 100).toFixed(0)}%
Brand Image Score: ${car.brand_image_score}/10
Annual Service Cost: ₹${car.service_cost_inr?.toLocaleString()}
Key Features: ABS=${car.abs}, Sunroof=${car.sunroof}, Cruise Control=${car.cruise_control}
Seating: ${car.seating_capacity}

Return ONLY valid JSON:
{
  "why_recommended": "2-3 sentences on why this car stands out for Indian buyers",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "best_for": "one-sentence description of ideal buyer profile",
  "value_score": number from 1 to 10
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "{}";
    const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    return {
      why_recommended: parsed.why_recommended || "A well-rounded vehicle offering good value.",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Good mileage", "Reliable brand"],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ["Limited features"],
      best_for: parsed.best_for || "Daily commuters and families.",
      value_score: Number(parsed.value_score) || 7,
    };
  } catch (e) {
    console.error("[Gemini] generateCarInsights error:", e);
    return {
      why_recommended: "A reliable vehicle from a trusted brand with good overall ratings.",
      strengths: ["Good mileage", "Reliable brand", "Good safety rating"],
      weaknesses: ["Limited premium features"],
      best_for: "Daily commuters and small families.",
      value_score: 7,
    };
  }
}

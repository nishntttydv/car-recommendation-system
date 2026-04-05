import { GoogleGenAI } from "@google/genai";

if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || !process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  throw new Error("AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY must be set");
}

export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
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
}

export async function processCarQuery(query: string): Promise<{ corrected_query: string; filters: ParsedFilters }> {
  const prompt = `You are a car search assistant that understands English, Hindi, and Hinglish queries about Indian cars.

Given this user query: "${query}"

Your tasks:
1. Correct any spelling mistakes (e.g. "hyndai" → "Hyundai", "Toyta" → "Toyota")
2. Extract structured filters from the query

Return ONLY valid JSON with no extra text:
{
  "corrected_query": "the corrected version of the original query",
  "brand": "brand name if mentioned, else null",
  "model": "model name if mentioned, else null",
  "body_type": "SUV/Sedan/Hatchback/MPV if mentioned, else null",
  "fuel_type": "Petrol/Diesel/Electric/CNG if mentioned, else null",
  "transmission": "Manual/Automatic if mentioned, else null",
  "budget_max": max budget in lakh as number if mentioned else null,
  "budget_min": min budget in lakh as number if mentioned else null,
  "seating_capacity": number if mentioned else null
}

Common Indian brands: Maruti Suzuki, Hyundai, Tata Motors, Honda, Toyota, Kia, Mahindra, Volkswagen, Skoda, Renault, Nissan
Common models: Swift, Baleno, WagonR, Alto K10, i20, Creta, Verna, Nexon, Punch, Tiago, City, Amaze, Seltos, Carens, XUV700, Thar, Scorpio N, Innova Crysta, Glanza, Urban Cruiser Hyryder, Kiger, Kwid, Triber, Magnite, Kicks, Taigun, Kushaq, Slavia, Virtus, Ertiga, Brezza, Venue, Sonet, Harrier, Safari, Fortuner, Octavia, Tiguan`;

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

    return {
      corrected_query: parsed.corrected_query || query,
      filters,
    };
  } catch {
    return { corrected_query: query, filters: {} };
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
  const prompt = `You are an automotive analyst. Analyze this Indian car and provide brief insights.

Car: ${car.brand} ${car.model} ${car.variant_name}
Price: ₹${car.price_lakh} lakh
Mileage: ${car.mileage_kmpl} km/l  
Fuel: ${car.fuel_type}
Safety Rating: ${car.safety_rating}/5
Sentiment Score: ${car.sentiment_score}/1.0
Brand Score: ${car.brand_image_score}/10
Service Cost: ₹${car.service_cost_inr}/year
Features: ABS=${car.abs}, Sunroof=${car.sunroof}, Cruise Control=${car.cruise_control}
Seating: ${car.seating_capacity}

Return ONLY valid JSON:
{
  "why_recommended": "2-sentence reason why this car stands out",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "best_for": "who this car is best for in one sentence",
  "value_score": score from 0 to 10 representing overall value
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
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      best_for: parsed.best_for || "Daily commuters and families.",
      value_score: Number(parsed.value_score) || 7,
    };
  } catch {
    return {
      why_recommended: "A reliable vehicle from a trusted brand.",
      strengths: ["Good mileage", "Reliable brand"],
      weaknesses: ["Limited features"],
      best_for: "Daily commuters.",
      value_score: 7,
    };
  }
}

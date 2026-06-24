import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function getGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set. Add it to .env.local");
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
}

/**
 * POST /api/estimate-food
 * Body: { name: string, quantity?: string }
 * Returns AI-estimated TOTALS for the food as eaten:
 *   { kcal, protein_g, carbs_g, fiber_g }
 */
export async function POST(req: Request) {
  try {
    const { name, quantity } = await req.json() as { name?: string; quantity?: string };
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Food name is required" }, { status: 400 });
    }

    const prompt = `Estimate the nutrition for this food AS EATEN, for the stated quantity.
Food: ${name.trim()}
Quantity: ${quantity?.trim() || "1 standard serving"}
Assume typical Indian home/restaurant preparation unless the name says otherwise.
Give realistic TOTALS (not per-100g) for the whole quantity.
Respond ONLY with this JSON, numbers only:
{"kcal": <integer>, "protein_g": <number>, "carbs_g": <number>, "fiber_g": <number>}`;

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a concise nutrition estimator. You ONLY respond with a valid JSON object — no markdown, no text outside it." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 200,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    let parsed: { kcal?: unknown; protein_g?: unknown; carbs_g?: unknown; fiber_g?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Could not estimate — try again or enter manually" }, { status: 502 });
    }

    const pos = (v: unknown, dp = 1) => {
      const n = Number(v);
      if (!isFinite(n) || n < 0) return 0;
      const f = Math.pow(10, dp);
      return Math.round(n * f) / f;
    };
    return NextResponse.json({
      kcal: Math.round(pos(parsed.kcal, 0)),
      protein_g: pos(parsed.protein_g),
      carbs_g: pos(parsed.carbs_g),
      fiber_g: pos(parsed.fiber_g),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Estimate failed" },
      { status: 500 }
    );
  }
}

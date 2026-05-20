import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadProfile, loadFoodRules } from "@/lib/profile-loader";
import { buildAnalysisPrompt } from "@/lib/prompt-builder";
import { saveSession } from "@/lib/session-store";
import type { DayLog, DayAnalysis } from "@/types";

function getGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set. Add it to .env.local");
  return new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const log = body.log as DayLog;

    if (!log?.date) {
      return NextResponse.json({ error: "Invalid log data" }, { status: 400 });
    }

    const [profile, rules] = await Promise.all([loadProfile(), loadFoodRules()]);
    const prompt = buildAnalysisPrompt(profile, rules, log);

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a precision cardiac nutrition AI. You ONLY respond with valid JSON. Never add markdown fences, explanations, or any text outside the JSON object.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 6000,
    });

    const raw = completion.choices[0].message.content ?? "{}";

    let structured: DayAnalysis;
    try {
      structured = JSON.parse(raw) as DayAnalysis;
      structured.analyzed_at = new Date().toISOString();
    } catch {
      return NextResponse.json(
        { error: "AI returned malformed JSON. Please try again." },
        { status: 500 }
      );
    }

    const updatedLog: DayLog = {
      ...log,
      analysis: structured,
      updated_at: new Date().toISOString(),
    };

    await saveSession(log.date, updatedLog);

    return NextResponse.json({ analysis: structured, log: updatedLog });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

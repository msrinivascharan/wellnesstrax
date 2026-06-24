import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadProfile, loadFoodRules } from "@/lib/profile-loader";
import { buildAnalysisPrompt } from "@/lib/prompt-builder";
import { saveSession } from "@/lib/session-store";
import { loadActivityHistory, summariseActivityHistory, summariseWellnessHistory } from "@/lib/activity-trends";
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

    const [profile, rules, activityHistory] = await Promise.all([
      loadProfile(),
      loadFoodRules(),
      loadActivityHistory(90),
    ]);

    // Only ask the AI for trend analysis once there's enough history to be meaningful
    const activityHistorySummary =
      activityHistory.length >= 2 ? summariseActivityHistory(activityHistory) : "";
    const wellnessHistorySummary =
      activityHistory.length >= 2
        ? summariseWellnessHistory(activityHistory, profile.daily_targets.water_ml)
        : "";

    const prompt = buildAnalysisPrompt(
      profile, rules, log, activityHistorySummary, wellnessHistorySummary
    );

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
      // Reserved completion budget. The full structured reply runs ~2,500–3,000
      // tokens; 4,500 leaves ample headroom while keeping us well under the
      // per-minute token cap (Groq counts prompt + max_tokens against TPM).
      max_tokens: 4500,
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

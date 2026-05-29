import type { UserProfile, FoodRules, DayLog } from "@/types";

export function buildAnalysisPrompt(
  profile: UserProfile,
  rules: FoodRules,
  log: DayLog,
  /** Enabled items from the Good to Eat list — used for next-day meal suggestions */
  goodToEatNames: string[] = [],
  /** Unique foods eaten each meal over the past 7 days — AI avoids repeating these */
  weekFoodsByMeal: Record<string, string[]> = {},
  /** Compact summary of activity history for trend analysis (empty = skip) */
  activityHistorySummary: string = ""
): string {
  const meds = profile.medications
    .map(m =>
      `  • ${m.name} ${m.dose}${m.time ? ` at ${m.time}` : ""}${m.condition ? ` (${m.condition})` : ""}\n    Interactions: ${m.interactions.join("; ")}`
    )
    .join("\n");

  const avoidRules = rules.always_avoid.map(r => `  ✗ ${r}`).join("\n");
  const encourageRules = rules.always_encourage.map(r => `  ✓ ${r}`).join("\n");

  const foodSummary = (["breakfast", "lunch", "dinner", "snacks"] as const)
    .map(meal => {
      const items = log.food[meal];
      if (!items || items.length === 0) return `  ${meal}: nothing logged`;
      const list = items.map(f => `${f.name} (${f.quantity_g}g${f.unit ? " " + f.unit : ""})`).join(", ");
      return `  ${meal}: ${list}`;
    })
    .join("\n");

  const medsTaken = log.medications
    .map(m => `  • ${m.name} ${m.dose} — ${m.taken ? `taken at ${m.taken_at || "unknown time"}` : "NOT TAKEN"}`)
    .join("\n");

  const suppTaken = log.supplements
    .map(s => `  • ${s.name} — ${s.taken ? `taken at ${s.taken_at || "unknown time"}` : "NOT TAKEN"}`)
    .join("\n");

  const gymSummary = log.activity.gym.did_gym
    ? `  Gym: YES (started ${log.activity.gym.started_at})\n` +
      log.activity.gym.exercises.map(e => {
        if (e.type === "cardio") return `    - ${e.name}: ${e.duration_min} min`;
        if (e.type === "core") return `    - ${e.name}: ${e.core_sets ?? 0} sets × ${e.hold_sec ?? 0}s hold`;
        const setsStr = e.sets?.map(s => `${s.reps}r × ${s.weight_kg}kg`).join(", ") ?? "";
        return `    - ${e.name}: ${setsStr}`;
      }).join("\n")
    : "  Gym: not done today";

  const walkSummary = log.activity.post_prandial_walks.length
    ? log.activity.post_prandial_walks.map(w => `  • Post-prandial walk after ${w.after_meal}: ${w.duration_min} min`).join("\n")
    : "  Post-prandial walks: none logged";

  const soleusSummary = log.activity.soleus_pumps.length
    ? log.activity.soleus_pumps.map(s => `  • Soleus pump after ${s.after_meal}: ${s.duration_min} min`).join("\n")
    : "  Soleus pump exercises: none logged";

  const sleepSummary = log.sleep.hours > 0
    ? `  ${log.sleep.hours}h (quality: ${log.sleep.quality || "not rated"})${log.sleep.bedtime ? `, bedtime ${log.sleep.bedtime}, wake ${log.sleep.wake_time}` : ""}`
    : "  Not logged";

  return `You are a precision cardiac nutrition AI. Respond ONLY with a valid JSON object — no markdown, no text outside the JSON.

PATIENT PROFILE
  Name: ${profile.display_name} | Age: ${profile.age} | Weight: ${profile.weight_kg}kg | BMI: ${profile.bmi} (target ${profile.target_bmi_range})
  CARDIAC STATUS: ${profile.cardiac_status}
  Targets: ${profile.daily_targets.calories} kcal · ${profile.daily_targets.protein_g}g protein · ${profile.daily_targets.fiber_g}g fiber · ${profile.daily_targets.water_ml}ml water

MEDICATIONS (screen every food item against these):
${meds}

FOOD RULES — ALWAYS AVOID:
${avoidRules}

FOOD RULES — ALWAYS ENCOURAGE:
${encourageRules}

TODAY'S LOG (${log.day}, ${log.date}):

Food eaten:
${foodSummary}

Medications:
${medsTaken}

Supplements:
${suppTaken}

Activity:
${gymSummary}
${walkSummary}
${soleusSummary}

Water: ${log.water_ml}ml / ${profile.daily_targets.water_ml}ml target
Sleep:
${sleepSummary}
${goodToEatNames.length > 0 ? `
NEXT DAY MEAL SUGGESTIONS CONTEXT:
Good to Eat list (suggest ONLY from these ${goodToEatNames.length} items):
  ${goodToEatNames.join(", ")}

Foods already eaten this week — avoid repeating these:
  Breakfast this week: ${(weekFoodsByMeal.breakfast ?? []).join(", ") || "none logged"}
  Lunch this week: ${(weekFoodsByMeal.lunch ?? []).join(", ") || "none logged"}
  Dinner this week: ${(weekFoodsByMeal.dinner ?? []).join(", ") || "none logged"}
  Snacks this week: ${(weekFoodsByMeal.snacks ?? []).join(", ") || "none logged"}` : ""}
${activityHistorySummary ? `
ACTIVITY HISTORY (for activity_trend_analysis — analyse trends, not just today):
${activityHistorySummary}` : ""}

Return ONLY this JSON structure (all fields required):
{
  "overall_score": <0-100 integer based on food quality, med adherence, activity, water, sleep>,
  "nutrition": {
    "estimated_calories": <integer>,
    "estimated_protein_g": <integer>,
    "estimated_fiber_g": <integer>,
    "assessment": "<one-sentence overall nutrition assessment>",
    "highlights": ["<positive observation 1>", "<positive observation 2>"],
    "concerns": ["<concern 1>", "<concern 2>"]
  },
  "activity_note": "<concise assessment of today's gym, walks, and soleus pump exercises>",
  "medication_adherence": {
    "score": <0-100>,
    "missed": ["<missed med name>"],
    "notes": "<note on adherence, especially critical cardiac meds>"
  },
  "water_note": "<hydration status and recommendation>",
  "sleep_note": "<sleep quality assessment and any recommendation>",
  "cardiac_safety_note": "<MOST IMPORTANT — cardiac safety assessment. Patient has coronary stents. Flag any risks.>",
  "inflammation_note": "<anti vs pro-inflammatory balance of today's food choices>",
  "top_wins": ["<win 1>", "<win 2>", "<win 3>"],
  "areas_to_improve": ["<area 1>", "<area 2>"],
  "next_day_meal_suggestions": {
    "breakfast": ["<3-4 items from Good to Eat list, not eaten this week, cardiac-appropriate for breakfast>"],
    "lunch":     ["<3-4 items from Good to Eat list, not eaten this week, cardiac-appropriate for lunch>"],
    "dinner":    ["<3-4 items from Good to Eat list, not eaten this week, cardiac-appropriate for dinner>"],
    "snacks":    ["<3-4 items from Good to Eat list, not eaten this week, cardiac-appropriate for snacks>"]
  },${activityHistorySummary ? `
  "activity_trend_analysis": {
    "summary": "<2-3 sentences on how activity is trending over the period — gym, walks, soleus>",
    "whats_good": ["<specific positive trend 1>", "<positive trend 2>"],
    "improvements": ["<specific actionable improvement 1>", "<improvement 2>"],
    "gym_insight": "<analyse gym time-spend: average session length, consistency, and how this cardiac patient can gain the most cardiovascular benefit from that time>",
    "consistency_note": "<observation on consistency/streaks and what to aim for next>"
  },
  "breathing_trend_analysis": {
    "summary": "<2-3 sentences on how the breathing practice (Box 4-4-4-4 + 4-7-8) is trending over the period>",
    "whats_good": ["<specific positive trend 1>", "<positive trend 2>"],
    "improvements": ["<specific actionable improvement 1>", "<improvement 2>"],
    "benefit_note": "<how this breathing practice helps THIS cardiac patient — vagal tone, heart-rate variability, blood pressure, stress/cortisol, sleep>",
    "consistency_note": "<observation on breathing-practice consistency/streaks and what to aim for next>"
  },` : ""}
  "analyzed_at": "${new Date().toISOString()}"
}`;
}

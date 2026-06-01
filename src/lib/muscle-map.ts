/**
 * Maps exercise names to the muscle groups they primarily work.
 * Pure module (no React) so it can be used both server-side (rollup) and client-side (map).
 */

export const MUSCLE_IDS = [
  "chest", "shoulders", "biceps", "triceps", "forearms", "abs",
  "lats", "traps", "lower_back", "glutes", "quads", "hamstrings", "calves",
] as const;
export type MuscleId = typeof MUSCLE_IDS[number];

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: "Chest", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps",
  forearms: "Forearms", abs: "Core / Abs", lats: "Back / Lats", traps: "Traps",
  lower_back: "Lower back", glutes: "Glutes", quads: "Quads", hamstrings: "Hamstrings",
  calves: "Calves",
};

// Ordered keyword → muscle rules. First matching rules accumulate; order matters
// so that e.g. "leg curl" hits hamstrings before a generic "curl" → biceps.
const RULES: Array<{ test: RegExp; muscles: MuscleId[] }> = [
  { test: /leg\s*curl|ham(string)?|rdl|romanian|deadlift/i, muscles: ["hamstrings", "glutes"] },
  { test: /leg\s*press|squat|lunge|leg\s*extension|hack/i, muscles: ["quads", "glutes"] },
  { test: /calf|soleus|calf\s*raise/i, muscles: ["calves"] },
  { test: /glute|hip\s*thrust|bridge/i, muscles: ["glutes"] },
  { test: /bench|chest|pec|push[\s-]?up|fly|dips?/i, muscles: ["chest", "triceps"] },
  { test: /lat\s*pull|pull[\s-]?up|pull[\s-]?down|chin[\s-]?up/i, muscles: ["lats", "biceps"] },
  { test: /\brow\b|seated\s*row|cable\s*row|bent[\s-]?over/i, muscles: ["lats", "traps"] },
  { test: /shoulder\s*press|overhead|military|lateral\s*raise|arnold|delt/i, muscles: ["shoulders", "triceps"] },
  { test: /shrug|trap/i, muscles: ["traps"] },
  { test: /tricep|push[\s-]?down|skull|kickback/i, muscles: ["triceps"] },
  { test: /bicep|curl/i, muscles: ["biceps"] },
  { test: /forearm|wrist|grip/i, muscles: ["forearms"] },
  { test: /plank|crunch|sit[\s-]?up|russian|leg\s*raise|\babs?\b|core|hollow/i, muscles: ["abs"] },
  { test: /back\s*extension|hyperext|lower\s*back/i, muscles: ["lower_back"] },
];

/** Returns the muscle groups an exercise name targets (empty array if unknown / cardio). */
export function getMusclesForExercise(name: string): MuscleId[] {
  const lc = (name || "").toLowerCase();
  const hits = new Set<MuscleId>();
  for (const rule of RULES) {
    if (rule.test.test(lc)) rule.muscles.forEach(m => hits.add(m));
  }
  return [...hits];
}

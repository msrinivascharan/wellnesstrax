// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Medication {
  name: string;
  dose: string;
  time?: string;
  frequency?: string;
  last_dose?: string;
  condition?: string;
  interactions: string[];
}

export interface UserProfile {
  name: string;
  display_name: string;
  age: number;
  weight_kg: number;
  height_ft: number;
  bmi: number;
  target_bmi_range: string;
  gender: string;
  cardiac_status: string;
  medications: Medication[];
  exercise: {
    frequency: string;
    duration_min: number;
    routine: string;
    additional: string;
    rest_day: string;
  };
  lifestyle: {
    profession: string;
    alcohol: boolean;
    added_sugar: boolean;
    smoker: boolean;
  };
  score_targets: {
    metabolic_efficiency: number;
    food_habit: number;
    cardiac_safety: number;
    longevity: number;
  };
  daily_targets: {
    water_ml: number;
    protein_g: number;
    fiber_g: number;
    calories: number;
  };
}

export interface SupplementRule {
  name: string;
  dose?: string;
  target: string;
  note: string;
}

export interface FoodRules {
  always_encourage: string[];
  supplements_to_track: SupplementRule[];
}

// ─── Food tracking ────────────────────────────────────────────────────────────

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface FoodEntry {
  id: string;
  name: string;
  category: string;       // e.g. "Fruits", "Protein", "custom"
  quantity_g: number;
  unit?: string;          // override unit label (e.g. "cups", "pieces")
  custom: boolean;
  logged_at: string;
  // ── Manually-entered nutrition (unplanned / cheat / eating-out items) ──
  // When `kcal` is set, these are the TOTALS for the item as eaten and are used
  // directly by Reports (no Foods-DB lookup, no gram scaling). Macros optional.
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fiber_g?: number;
}

// ─── Activity tracking ────────────────────────────────────────────────────────

export type ExerciseType = "cardio" | "strength" | "core";

export interface ExerciseSet {
  set_number: number;
  reps: number;
  weight_kg: number;
}

export interface ExerciseEntry {
  name: string;
  type: ExerciseType;
  duration_min?: number;    // cardio
  sets?: ExerciseSet[];     // strength
  core_sets?: number;       // core sets count
  hold_sec?: number;        // core hold duration per set
}

export interface GymSession {
  did_gym: boolean;
  started_at: string;       // "07:00"
  ended_at?: string;        // "08:15" — optional, enables duration calculation
  exercises: ExerciseEntry[];
}

export interface PrandialActivity {
  after_meal: MealType;
  duration_min: number;
  logged_at: string;
}

/** A sport/game session (e.g. badminton) */
export interface SportSession {
  duration_min: number;
  intensity: "light" | "moderate" | "intense";
  games?: number;   // number of games played
  wins?: number;    // games won
  losses?: number;  // games lost
  notes?: string;
  logged_at: string;
}

export interface BreathingLog {
  box_4444: number;        // rounds done today (target 5–6)
  long_exhale_478: number; // rounds done today (target 2)
}

export interface ActivityLog {
  gym: GymSession;
  post_prandial_walks: PrandialActivity[];
  soleus_pumps: PrandialActivity[];
  breathing: BreathingLog;
  badminton?: SportSession[];   // optional — badminton/sport sessions for the day
}

// ─── Medication & supplement tracking ────────────────────────────────────────

export interface MedicationEntry {
  name: string;
  dose: string;
  scheduled_time: string;
  condition?: string;
  taken: boolean;
  taken_at: string;
}

export interface SupplementEntry {
  name: string;
  dose: string;
  scheduled_time: string;
  taken: boolean;
  taken_at: string;
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

/** One daytime nap (a day can have several) */
export interface NapEntry {
  start?: string;   // "HH:MM"
  end?: string;     // "HH:MM" — auto-calculates hours when both set
  hours: number;    // duration in hours (manually editable)
}

export interface SleepLog {
  hours: number;
  quality: "excellent" | "good" | "fair" | "poor" | "";
  bedtime: string;
  wake_time: string;
  notes: string;
  /** All daytime naps. nap_hours is kept equal to their total for trends/back-compat. */
  naps?: NapEntry[];
  nap_hours?: number;   // total daytime nap duration across all naps
  nap_start?: string;   // legacy single-nap start — migrated into naps[] on first edit
  nap_end?: string;     // legacy single-nap end — migrated into naps[] on first edit
  /** Post-lunch drowsiness intensity (postprandial somnolence / post-lunch dip) */
  post_lunch_sleepiness?: "" | "none" | "controllable" | "uncontrollable";
  /** Evening energy dip / drowsiness intensity */
  evening_dip?: "" | "none" | "controllable" | "uncontrollable";
}

// ─── Day Log (main daily record) ─────────────────────────────────────────────

export interface DayLog {
  date: string;              // "YYYY-MM-DD"
  day: string;               // "Monday"
  food: Record<MealType, FoodEntry[]>;
  meal_times?: Partial<Record<MealType, string>>;  // "HH:MM" per meal (optional)
  water_ml: number;
  sleep: SleepLog;
  medications: MedicationEntry[];
  supplements: SupplementEntry[];
  activity: ActivityLog;
  analysis?: DayAnalysis;
  created_at: string;
  updated_at: string;
}

// ─── Meal planner (breakfast / lunch / dinner — <meal>_foods.json + <meal>_plans.json) ──

export type MealKey = "breakfast" | "lunch" | "dinner";

/** One food in a meal's per-100g database (Foods tab) */
export interface MealFood {
  id: string;
  category: string;
  item: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fiber_100g: number;
  cooking_method: string;
  typical_unit: string;
  notes: string;
}

export interface MealTarget { kcal: number; protein: number; carbs: number; fiber: number; }

/** <meal>_foods.json — editable database + notes + plate target */
export interface MealFoodsData {
  foods: MealFood[];
  notes: string;
  target: MealTarget;
}

/** A chosen item + raw grams for one plate slot */
export interface MealPlanSlot { item: string; qty_g: number; }

/** slotId → chosen item; a whole day's planned plate */
export type MealPlan = Record<string, MealPlanSlot>;

// ─── Analysis output ──────────────────────────────────────────────────────────

export interface NutritionInsight {
  estimated_calories: number;
  estimated_protein_g: number;
  estimated_fiber_g: number;
  assessment: string;
  highlights: string[];
  concerns: string[];
}

export interface MedicationAdherence {
  score: number;            // 0-100
  missed: string[];
  notes: string;
}

/** LLM-generated activity trend analysis (gym, walks, soleus over time) */
export interface ActivityTrendAnalysis {
  summary: string;          // how activity is going overall across the period
  whats_good: string[];     // what is going well
  improvements: string[];   // what needs improvement
  gym_insight: string;      // gym time-spend analysis + how to gain the most from it
  consistency_note: string; // consistency / streak observation
}

/** LLM-generated breathing-practice trend analysis (box 4-4-4-4 + 4-7-8 over time) */
export interface BreathingTrendAnalysis {
  summary: string;          // how the breathing practice is going across the period
  whats_good: string[];     // what is going well
  improvements: string[];   // what needs improvement
  benefit_note: string;     // cardiac / nervous-system benefit of the practice for this patient
  consistency_note: string; // consistency / streak observation
}

/** Generic per-section activity insight (cardio, strength, indoor, badminton) */
export interface SectionInsight {
  summary: string;
  whats_good: string[];
  improvements: string[];
}

/** Overall activity insight tying all sections together */
export interface OverallActivityInsight {
  summary: string;          // data-grounded synthesis of the whole movement picture
  body_feel: string;        // how the body benefits / feels good from these activities
  balance_note: string;     // balance across cardio / strength / NEAT / badminton + one adjustment
  consistency_note: string; // constructive, encouraging note on consistency + a realistic target
}

/** All sectioned activity analyses, generated together on Re-analyse */
export interface ActivitySectionAnalysis {
  overall:   OverallActivityInsight;
  cardio:    SectionInsight;
  strength:  SectionInsight;
  indoor:    SectionInsight;   // post-prandial walks + soleus pumps
  badminton: SectionInsight;
}

/** Generic trend insight for hydration / sleep sections */
export interface TrendInsight {
  summary: string;
  whats_good: string[];
  improvements: string[];
  consistency_note: string;
}

export interface DayAnalysis {
  overall_score: number;    // 0-100
  nutrition: NutritionInsight;
  activity_note: string;
  medication_adherence: MedicationAdherence;
  water_note: string;
  sleep_note: string;
  cardiac_safety_note: string;
  inflammation_note: string;
  top_wins: string[];
  areas_to_improve: string[];
  /** Trend-based activity analysis over the past weeks (optional, legacy single-block) */
  activity_trend_analysis?: ActivityTrendAnalysis;
  /** Sectioned activity analyses — cardio, strength, indoor, badminton + overall */
  activity_section_analysis?: ActivitySectionAnalysis;
  /** Trend-based breathing-practice analysis (optional, set on Re-analyse) */
  breathing_trend_analysis?: BreathingTrendAnalysis;
  /** Trend-based hydration analysis (optional, set on Re-analyse) */
  hydration_trend_analysis?: TrendInsight;
  /** Trend-based sleep analysis (optional, set on Re-analyse) */
  sleep_trend_analysis?: TrendInsight;
  analyzed_at: string;
}

// ─── Activity trends (computed from session history) ─────────────────────────

/** One day's activity rollup, used for trend charts and LLM context. */
export interface DailyActivityPoint {
  date: string;             // "YYYY-MM-DD"
  weekday: string;          // "Mon"
  gymDone: boolean;
  gymMin: number;           // computed from started_at/ended_at (0 if unknown)
  exerciseCount: number;
  cardioMin: number;        // sum of cardio-exercise duration_min in the gym
  strengthSets: number;     // total sets across strength exercises
  strengthVolume: number;   // sum of reps × weight_kg across all strength sets
  walks: number;            // count of post-prandial walks
  walkMin: number;
  soleus: number;           // count of soleus pump sessions
  soleusMin: number;
  badmintonMin: number;     // total badminton minutes
  badmintonGames: number;   // total badminton games
  muscles: Record<string, number>; // muscle id → sets worked that day
  strengthExercises: string[];     // names of strength/core exercises done that day
  boxRounds: number;        // 4-4-4-4 box-breathing rounds
  longExhaleRounds: number; // 4-7-8 long-exhale rounds
  breathingRounds: number;  // box + long-exhale rounds (total)
  activeMin: number;        // gymMin + walkMin + soleusMin + badmintonMin
  // Wellness (hydration + sleep) for the day
  waterMl: number;
  sleepHours: number;
  sleepQuality: string;     // "" | excellent | good | fair | poor
  napHours: number;
  postLunchDip: string;     // "" | none | controllable | uncontrollable
}

// ─── Data files (activities.json) ─────────────────────────────────────────────

export interface ActivityDefinition {
  name: string;
  type: ExerciseType;
  default_sets?: number;
  default_reps?: number;
  default_weight_kg?: number;
  default_duration_min?: number;
  default_duration_sec?: number;
}

export interface DailyActivityDef {
  label: string;
  description: string;
  after_meals: string[];
  default_duration_min: number;
}

export interface ActivitiesData {
  gym: Record<string, ActivityDefinition[]>;
  daily_activities: Record<string, DailyActivityDef>;
}

// ─── Blood work ───────────────────────────────────────────────────────────────

export interface LipidProfile {
  id: string;
  test_date: string;            // "YYYY-MM-DD"
  total_cholesterol: number;    // mg/dL
  hdl: number;                  // mg/dL
  ldl: number;                  // mg/dL
  vldl: number;                 // mg/dL
  triglycerides: number;        // mg/dL
  chol_hdl_ratio: number;       // ratio
  non_hdl: number;              // mg/dL
}

export interface ThyroidProfile {
  id: string;
  test_date: string;            // "YYYY-MM-DD"
  t3_ng_ml: number | null;      // ng/mL  (normal 0.8–2.0) — null if not tested in this panel
  t4_ug_dl: number | null;      // μg/dL  (normal 5.1–14.1) — null if not tested in this panel
  tsh_uiu_ml: number;           // μIU/mL — always required
}

export interface BloodPressureReading {
  id: string;
  test_date: string;            // "YYYY-MM-DD"
  time?: string;                // "HH:MM" — hour of day the reading was taken
  systolic: number;             // mmHg
  diastolic: number;            // mmHg
  pulse: number | null;         // bpm — optional
  arm?: "left" | "right" | null; // which arm the cuff was on — optional
}

/**
 * Daily mood check-in — simplified circumplex model of affect
 * (valence × energy) plus stress, which is cardiac-relevant. One per day.
 */
export interface MoodEntry {
  id: string;
  test_date: string;            // "YYYY-MM-DD" — one entry per day
  valence: number;              // 1 very low · 2 low · 3 neutral · 4 good · 5 great
  energy: "" | "low" | "medium" | "high";   // arousal dimension — optional
  stress: "" | "low" | "medium" | "high";   // perceived stress — optional
  note?: string;                // what influenced it
}

export interface WeightReading {
  id: string;
  test_date: string;            // "YYYY-MM-DD"
  weight_kg: number;            // kg
}

export interface BloodWorkData {
  lipid_profile: LipidProfile[];
  thyroid_profile: ThyroidProfile[];
  bp_readings?: BloodPressureReading[];     // optional — blood pressure history
  weight_readings?: WeightReading[];        // optional — body weight history
  weight_target_kg?: number | null;         // optional — target body weight
  mood_entries?: MoodEntry[];               // optional — daily mood check-ins
}

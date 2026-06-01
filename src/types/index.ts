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

export interface ExpertPanelMember {
  id: string;
  name: string;
  title: string;
  focus: string;
}

export interface FoodRules {
  always_avoid: string[];
  always_encourage: string[];
  supplements_to_track: SupplementRule[];
  expert_panel: ExpertPanelMember[];
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

export interface SleepLog {
  hours: number;
  quality: "excellent" | "good" | "fair" | "poor" | "";
  bedtime: string;
  wake_time: string;
  notes: string;
  nap_hours?: number;   // daytime / afternoon nap duration (default 0)
  nap_start?: string;   // "HH:MM" — nap start time
  nap_end?: string;     // "HH:MM" — nap end time (auto-calculates nap_hours)
  /** Post-lunch drowsiness intensity (postprandial somnolence / post-lunch dip) */
  post_lunch_sleepiness?: "" | "none" | "controllable" | "uncontrollable";
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
  summary: string;          // how activity is going overall
  body_feel: string;        // how the body benefits / feels good from these activities
  gap_impact: string;       // impact of missing activity (a day, several in a row, long gaps)
  consistency_note: string; // streaks, current gap, what to aim for
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
  /** Per-meal next-day food suggestions from the Good to Eat list, not eaten this week */
  next_day_meal_suggestions?: {
    breakfast: string[];
    lunch:     string[];
    dinner:    string[];
    snacks:    string[];
  };
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

// ─── Food preference lists (food_preferences.json) ───────────────────────────

export interface FoodPreferenceItem {
  name: string;
  category: string;
  subcategory: string;
  frequency: string;
  notes: string;
  enabled: boolean;
}

export interface FoodPreferences {
  avoid: FoodPreferenceItem[];
  encourage: FoodPreferenceItem[];
}

// ─── Data files (food_items.json + activities.json) ───────────────────────────

export interface FoodItemsData {
  meals: Record<string, Record<string, string[]>>;
}

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

export interface BloodWorkData {
  lipid_profile: LipidProfile[];
  thyroid_profile: ThyroidProfile[];
}

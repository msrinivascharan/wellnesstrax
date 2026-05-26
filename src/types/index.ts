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

export interface BreathingLog {
  box_4444: number;        // rounds done today (target 5–6)
  long_exhale_478: number; // rounds done today (target 2)
}

export interface ActivityLog {
  gym: GymSession;
  post_prandial_walks: PrandialActivity[];
  soleus_pumps: PrandialActivity[];
  breathing: BreathingLog;
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

export interface DrugFoodAlert {
  drug: string;
  food: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  action: string;
}

export interface NutritionInsight {
  estimated_calories: number;
  estimated_protein_g: number;
  estimated_fiber_g: number;
  assessment: string;
  highlights: string[];
  concerns: string[];
  drug_food_alerts: DrugFoodAlert[];
}

export interface MedicationAdherence {
  score: number;            // 0-100
  missed: string[];
  notes: string;
}

export interface AvoidForeverItem {
  food: string;      // specific item name from today's log
  reason: string;    // why it is harmful for this cardiac patient
}

export interface AddTomorrowItem {
  item: string;      // specific food or habit to add
  benefit: string;   // precise health benefit for this cardiac patient
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
  foods_to_avoid_forever: AvoidForeverItem[];   // items from today never to eat again
  add_from_tomorrow: AddTomorrowItem[];          // new items to start incorporating
  top_wins: string[];
  areas_to_improve: string[];
  tomorrow_focus: string[];
  analyzed_at: string;
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
  t3_ng_ml: number;             // ng/mL  (normal 0.8–2.0)
  t4_ug_dl: number;             // μg/dL  (normal 5.1–14.1)
  tsh_uiu_ml: number;           // μIU/mL (on Thyroxin target 0.5–2.5)
}

export interface BloodWorkData {
  lipid_profile: LipidProfile[];
  thyroid_profile: ThyroidProfile[];
}

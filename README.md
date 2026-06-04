# WellnessTrax — AI-Powered Daily Health Tracker

> A local-first, AI-powered personal health OS.  
> Track food, activity, medications, blood work, sleep, breathing, and water — analysed daily by LLaMA 3.3 70B.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Groq](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3%2070B-f97316)
![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)

---

## What it is

WellnessTrax is a **local-first, form-based daily health tracker** built around your personal profile — your medications, health conditions, BMI, daily targets, and doctor-prescribed food rules.

Every day, you log your meals, medications, supplements, gym workouts, walks, badminton, breathing exercises, water, sleep, and blood work through a clean sidebar interface. When you're ready, a single click runs a full AI analysis that scores your day, balances each meal's plate, suggests what to eat tomorrow, and analyses how your activity (cardio, strength, indoor movement, badminton), breathing, hydration, and sleep are trending over time — including a body muscle map of what you've trained.

Your health data **never leaves your machine** except the anonymised text log sent to Groq when you explicitly run an analysis.

---

## App Sections

| # | Section | What you do here |
|---|---------|-----------------|
| 1 | **Dashboard** | At-a-glance daily rings (food = 3 main meals logged, water, activity, sleep, meds), time-aware missed-medication alerts, quick stats, and today's AI score if analysed |
| 2 | **Food Log** | Log breakfast/lunch/dinner/snacks with meal time. **Typeahead search** adds items from your food lists, then a quantity/unit picker. Maintain rich **Must Avoid** / **Good to Eat** lists with category filters and per-item enable/disable |
| 3 | **Activity** | Log gym session with in/out time and auto-calculated duration, exercises with sets/reps/weights, post-prandial walks, soleus pumps, **badminton** (duration/intensity/games), and breathing exercises |
| 4 | **Medications** | Mark each scheduled medication and supplement taken with timestamp. Periodic injectable tracking with auto-calculated next-due status badge |
| 5 | **Blood Work & Vitals** | Log and track **lipid, thyroid, blood-pressure, and weight** panels over time with trend arrows and reference ranges. Thyroid supports **TSH-only panels** (T3/T4 optional); BP captures systolic/diastolic + optional pulse; weight auto-computes **BMI** vs your target range |
| 6 | **Water & Sleep** | Hydration tracker, sleep log (hours, quality, bedtime/wake), daytime nap with start/end times, and **post-lunch dip** + **evening dip** trackers |
| 7 | **Reports** | Run AI analysis; meal-wise balanced-plate donuts (with Nutrition) and avoid-list flagging; **per-meal next-day suggestions**; **sectioned Activity trends** (Overall, Cardio, Strength + body **muscle map**, Indoor, Badminton); **Breathing**, **Hydration**, and **Sleep** trend sections — all with charts and AI insights; blood-work snapshot; and a date navigator to revisit any past day |

---

## Key Features

### Food logging
- **Typeahead search** — start typing and pick from a deduplicated pool of your **Good to Eat** list plus the pre-defined `food_items.json`; already-logged items are shown as crossed-out so you never double-add
- **Quantity + unit picker** — after selecting an item, set the amount with smart default units (g / ml / pieces / cups / tbsp / tsp), auto-guessed from the food name
- **Rich Must Avoid / Good to Eat lists** — each item carries `{ name, category, subcategory, frequency, notes, enabled }`
  - **Category filter pills** to slice each list by group (Vegetables, Fruits, Fried Foods, Sweets, etc.)
  - **Per-item enable/disable** (soft toggle) — pause an item without deleting it, or remove entirely
  - Add new items inline with category + notes
- **Meal time logging** — record the actual clock time of each meal
- **Balanced-plate categorisation** — every item maps to 5 canonical groups (Complex Carbohydrates, Lean/Plant Proteins, Dietary Fiber, Micronutrients, Essential Lipids)

### Reports & AI analysis
- **Meal-wise balanced plate** — a donut per meal (breakfast/lunch/dinner/snacks) with a per-meal balance score, missing-group hints, a hover item breakdown, and a **Nutrition** card (estimated calories/protein/fiber vs target)
- **Avoid-list flagging** — logged foods are cross-checked against both `food_rules.json` (complex rules) and your editable **Must Avoid** list (parenthetical qualifiers like "White Rice (Regular Use)" still match "White Rice"); violations are highlighted per meal and inside the hover breakdown
- **Per-meal next-day suggestions** — after Re-analyse, each meal card shows 3–4 "Try tomorrow" picks drawn from your **Good to Eat** list that you have **not** eaten in the past 7 days
- **Sectioned Activity trends** *(own section)* — daily / weekly / monthly charts and per-section AI insights for:
  - **Overall movement** — stacked gym/walk/soleus/badminton minutes, active-day / gym-day / current-gap tiles, plus an AI synthesis (summary, how your body benefits, activity balance, consistency)
  - **Cardio** — cardio minutes trend
  - **Strength & muscles** — a front + back **body muscle map** shaded by sets worked (teal = worked, amber = not worked), with the exercises that hit each muscle, plus a sets/volume trend
  - **Indoor** — post-meal walks + soleus pumps
  - **Badminton** — minutes + games trend
- **Breathing insights** — daily / weekly / monthly charts of Box 4-4-4-4 and 4-7-8 rounds, plus an AI write-up (summary, what's good, improvements, why it helps your heart, consistency)
- **Hydration trends** — daily / weekly / monthly average-intake bars vs your target line, target-met days, with AI analysis
- **Sleep trends** — average sleep-hours bars vs a 7h target, nights ≥7h, average nap, sleep-quality distribution, post-lunch-dip counts, with AI analysis
- **AI health score** — overall daily score with macro estimates, nutrition highlights/concerns, top wins, and areas to improve
- **Latest vitals & blood-work snapshot** — most recent weight & BMI, blood pressure, and lipid & thyroid markers vs cardiac-patient targets, colour-coded
- **Date navigator** — jump to any previous day and view that day's data and analysis

### Activity & wellness
- **Gym session timing** — log gym in/out time; duration auto-calculated and shown as a pill
- **Gym defaults carry forward** — a new day pre-fills the gym exercises and their weights/reps from your most recent logged gym session; change them and the new values become the default from then on (gym only)
- **Badminton** — log each session's duration, intensity (light/moderate/intense), games, and win/loss
- **Daytime nap tracking** — log nap start/end times; duration auto-calculated
- **Breathing exercise tracker** — log Box (4-4-4-4) and Long-Exhale (4-7-8) rounds with progress bars
- **Post-lunch dip** and **evening dip** — track drowsiness/energy dips on a 3-level scale (None / Controllable / Uncontrollable)

### Blood work & vitals
- **Four panels** — Lipid profile, Thyroid profile, **Blood Pressure**, and **Weight**, each with history, trend arrows, and cardiac-patient reference ranges
- **TSH-only thyroid panels** — leave T3/T4 blank when not tested (stored as null, never flagged as out-of-range)
- **Blood pressure** — systolic/diastolic (required) + optional pulse, scored against a `<130/80` cardiac target with an interpretation banner
- **Weight** — log weight (kg) over time; **BMI is auto-computed** from your profile height, colour-coded against the healthy range, with the change since the previous reading

### Medications
- **Time-aware alerts** — missed warnings only appear after the scheduled dose time has passed
- **Injectable tracker** — periodic shots tracked with date and dose, auto-calculated next-due, and a colour-coded status badge; the injectable name is read from your profile

### App
- **Past-date editing** — navigate to any previous day from the sidebar to log or correct data
- **Auto-save** — debounced 900 ms auto-save on every change, no manual save button
- **Data backup** — one-click download of all config + recent sessions as a single JSON archive
- **Fully local** — no database, no cloud sync, no account required
- **Pluggable profile** — every personal detail lives in `data/*.json`; no user specifics are hardcoded in the source, so the app adapts to any person by editing data files alone

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| AI | Groq API — LLaMA 3.3 70B Versatile |
| AI Client | OpenAI SDK (pointed at Groq's OpenAI-compatible endpoint) |
| Charts | Hand-built SVG / CSS (no chart library) |
| Storage | Local JSON files (`data/`) |
| Date utilities | date-fns |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com/keys) (no credit card; free tier gives 14,400 req/day)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/wellnesstrax.git
cd wellnesstrax
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your Groq API key:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Add your data files

The entire `data/` folder is gitignored, so a fresh clone has none of it. Create `data/` and add your own JSON config (see **Configuration Files** below). At minimum you need `profile.json`; the rest are created/edited from within the app or seeded from the schemas below.

### 4. Install dependencies & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app creates `data/sessions/` automatically on first use.

---

## Project Structure

```
wellnesstrax/
├── data/                        # All personal health data — gitignored, local only
│   ├── profile.json             # User profile: age, weight, medications, targets
│   ├── food_rules.json          # Always-avoid/encourage rules + supplements + expert panel
│   ├── food_items.json          # Pre-defined food lists per meal (search source)
│   ├── food_preferences.json    # Rich Must Avoid / Good to Eat lists (edit in-app)
│   ├── activities.json          # Exercise definitions: gym + daily activities
│   ├── bloodwork.json           # Blood work history
│   ├── injectable_meds.json     # Injectable medication history
│   └── sessions/                # Daily logs — one file per day
│       └── YYYY-MM-DD.json
│
├── src/
│   ├── app/
│   │   ├── page.tsx             # Root page: loads all data, mounts layout, wires handlers
│   │   └── api/
│   │       ├── analyze/          # POST — runs Groq AI analysis on the day's log
│   │       ├── activity-trends/  # GET — per-day activity rollups for trend charts
│   │       ├── sessions/         # GET list of available session dates
│   │       ├── sessions/[date]/  # GET, PUT, DELETE a specific day's session
│   │       ├── backup/           # GET — downloads all data as a JSON archive
│   │       ├── bloodwork/        # GET, PUT — blood work history
│   │       ├── injectable-meds/  # GET, PUT — injectable medication history
│   │       ├── profile/          # GET profile.json
│   │       ├── food-rules/       # GET food_rules.json
│   │       ├── food-items/       # GET · PUT add · DELETE remove · PATCH recategorise
│   │       ├── food-preferences/ # GET + PUT — Must Avoid / Good to Eat lists
│   │       └── activities/       # GET activities.json
│   │
│   ├── components/
│   │   ├── Sidebar.tsx          # Navigation sidebar with completion rings + date navigation
│   │   └── sections/
│   │       ├── Dashboard.tsx       # Overview: rings, missed meds, quick stats, score summary
│   │       ├── FoodLog.tsx         # Meal logging: typeahead search + Must Avoid/Good to Eat lists
│   │       ├── ActivityLog.tsx     # Gym + walks + soleus + badminton + breathing
│   │       ├── ActivityTrends.tsx  # Sectioned activity (cardio/strength/indoor/badminton) + breathing trends
│   │       ├── MuscleMap.tsx       # Front+back body muscle map (worked vs untrained, exercise→muscle)
│   │       ├── HydrationTrends.tsx # Hydration trend charts + AI (Reports)
│   │       ├── SleepTrends.tsx     # Sleep trend charts + AI (Reports)
│   │       ├── trends-common.tsx   # Shared trend UI: PeriodToggle, StatTile, bucketing, bar chart
│   │       ├── MedicationLog.tsx   # Med/supplement check-off + injectable tracker
│   │       ├── BloodWork.tsx       # Lipid, thyroid, blood-pressure & weight (BMI) entry + history
│   │       ├── WaterSleep.tsx      # Hydration + sleep + nap + post-lunch/evening dip
│   │       └── Reports.tsx         # Plate charts + Nutrition + all trend sections + history navigator
│   │
│   ├── lib/
│   │   ├── food-utils.ts         # autoCategory(), resolveCategory(), mapToBalancedPlate(),
│   │   │                         # checkAlwaysAvoidRules() — shared categorisation helpers
│   │   ├── activity-trends.ts    # Reads session history → per-day activity/wellness rollups + summaries
│   │   ├── muscle-map.ts         # Exercise-name → muscle-group mapping (shared, pure)
│   │   ├── prompt-builder.ts     # Builds the full AI analysis prompt from the day's log + context
│   │   ├── profile-loader.ts     # Reads/writes all data/*.json config files
│   │   └── session-store.ts      # Read/write/list daily session JSON files
│   │
│   └── types/
│       └── index.ts             # All TypeScript interfaces (DayLog, DayAnalysis, etc.)
│
├── LICENSE                      # PolyForm Noncommercial License 1.0.0
├── .env.example                 # Safe to commit — contains only a placeholder key
├── .gitignore                   # Excludes .env.local and the entire data/ folder
└── package.json
```

---

## Configuration Files

> The whole `data/` folder is gitignored. The schemas below describe what each file holds so you can create your own.

### `data/profile.json`

The user's medical and nutritional profile — the main file to edit when adapting the app for a different person.

```json
{
  "name": "Mr. X",
  "age": 40,
  "weight_kg": 80,
  "bmi": 27,
  "cardiac_status": "Brief description of health status and AI priority constraints",
  "medications": [
    {
      "name": "Medication Name",
      "dose": "90mg",
      "time": "9AM and 9PM",
      "condition": "Post-meal",
      "interactions": ["food1", "food2"]
    }
  ],
  "daily_targets": { "calories": 1800, "protein_g": 120, "fiber_g": 35, "water_ml": 3000 }
}
```

Medications with `"time": "9AM and 9PM"` are auto-split into two daily entries. Medications **without** a `time` field (e.g. injectables) are skipped from the daily check-off and surface in the injectable tracker instead. The drug-interaction reminder card and AI prompt are built dynamically from this list — nothing is hardcoded.

### `data/food_rules.json`

Doctor/dietitian-approved rules loaded into every AI analysis:

- `always_avoid` — hard no's (specific interactions, harmful ingredients), checked against every logged meal
- `always_encourage` — foods to favour
- `supplements_to_track` — prescribed supplements with timing and targets
- `expert_panel` — reference nutritionist personas used to frame AI context

### `data/food_items.json`

Pre-defined food lists, organised by `meal → category → [items]`. These feed the Food Log **typeahead search** pool. Edit freely; the API also supports add/remove/recategorise.

```json
{
  "meals": {
    "breakfast": {
      "Fruits":        ["Blueberries", "Guava", "Avocado"],
      "Nuts & Seeds":  ["Groundnuts", "Walnuts"],
      "Dietary Fiber": ["Psyllium husk"]
    },
    "lunch": {}, "dinner": {}, "snacks": {}
  }
}
```

### `data/food_preferences.json`

Your rich **Must Avoid** / **Good to Eat** lists, managed entirely from the Food Log section. Changes save immediately via the API.

```json
{
  "avoid": [
    { "name": "White Rice (Regular Use)", "category": "Refined Grains",
      "subcategory": "", "frequency": "Limit", "notes": "Spikes blood sugar", "enabled": true }
  ],
  "encourage": [
    { "name": "Blueberries", "category": "Fruits",
      "subcategory": "Berries", "frequency": "Daily", "notes": "Polyphenols", "enabled": true }
  ]
}
```

- `avoid` items are cross-checked against every meal in Reports and highlighted in red (including inside the hover breakdown). Disabled items (`enabled: false`) are skipped.
- `encourage` items power the **Good to Eat** list, the Food Log search pool, and the **next-day meal suggestions**.

### `data/activities.json`

Defines available gym exercises and daily activities (post-prandial walks, soleus pumps) with default sets/reps/weights/durations used to pre-populate the activity log.

### `data/bloodwork.json`

Lipid, thyroid, blood-pressure, and weight history (`lipid_profile`, `thyroid_profile`, `bp_readings`, `weight_readings`). The thyroid panel supports **TSH-only** entries — leave T3/T4 blank and they are stored as `null` (shown as "not tested", never counted as out-of-range). Blood-pressure readings store systolic/diastolic (required) and an optional pulse. Weight readings store a date + weight in kg; BMI is computed live from your profile height.

### `data/injectable_meds.json`

Injectable medication history. The Medications section shows the latest dose date, auto-calculates next-due, and displays a colour-coded status badge.

---

## Data & Privacy

| Path | Committed? | Contains |
|------|-----------|---------|
| `data/` *(entire folder)* | ✗ Gitignored | All personal health data — stays on your machine only |
| `data/profile.json` | ✗ Gitignored | Your medical profile, medications, targets |
| `data/food_rules.json` | ✗ Gitignored | Your food/drug interaction rules |
| `data/food_items.json` | ✗ Gitignored | Your food lists |
| `data/food_preferences.json` | ✗ Gitignored | Your Must Avoid / Good to Eat lists |
| `data/activities.json` | ✗ Gitignored | Your exercise definitions |
| `data/bloodwork.json` | ✗ Gitignored | Your lab results |
| `data/injectable_meds.json` | ✗ Gitignored | Your injection history |
| `data/sessions/` | ✗ Gitignored | Your daily logs |
| `.env.local` | ✗ Gitignored | API key |

**No personal details are hardcoded in the source** — the app is fully data-driven from `data/*.json`. **No external data transmission** except the AI analysis call, which sends the day's text log (plus recent food/activity history for trend context) to Groq when you click Generate / Re-analyse. Nothing else leaves your machine.

> ⚠️ **Back up your `data/` folder.** Because the whole folder is gitignored, git is **not** a backup. Copy `data/` to an encrypted cloud folder or external drive regularly, and/or use the in-app **📦 Backup** button in Reports to download a full JSON archive.

---

## AI Analysis Details

**Model**: `llama-3.3-70b-versatile` via Groq  
**Free tier**: 14,400 requests/day (~1–2 used per analysis)  
**Typical response time**: 10–25 seconds  
**Output format**: Structured JSON (enforced via `response_format: { type: "json_object" }`)

### What the AI produces

- Estimated macros (calories, protein, fiber) with a one-line assessment, highlights, and concerns
- Overall daily health score (0–100)
- Top wins and areas to improve
- **Per-meal next-day suggestions** — items from your Good to Eat list not eaten in the past 7 days
- **Sectioned activity analysis** *(when ≥ 2 days of history exist)* — an overall synthesis (summary, how your body benefits, activity balance, consistency) plus per-section insights for **cardio**, **strength** (with muscle-balance notes), **indoor** movement, and **badminton**
- **Breathing trend analysis** — summary, what's good, improvements, cardiovascular benefit, consistency
- **Hydration trend analysis** and **sleep trend analysis** — summary, what's good, improvements, consistency

> The model also generates cardiac-safety, inflammation, medication-adherence, and hydration/sleep daily notes that are retained in each session's data; some are surfaced in their relevant trend sections rather than as standalone cards.

The analyze route assembles context server-side: today's log, your medications and food rules, the enabled Good to Eat list, the past 7 days of foods per meal, and a 90-day activity + hydration/sleep rollup. To switch the model, edit `src/app/api/analyze/route.ts`:

```typescript
model: "llama-3.3-70b-versatile",  // or "llama-3.1-8b-instant" for faster/cheaper
```

---

## Adapting for a Different User

WellnessTrax is entirely profile-driven — no hardcoded user details exist in the code.

1. Edit `data/profile.json` with the person's name, age, weight, BMI, medications, and daily targets
2. Edit `data/food_rules.json` with their specific food rules and supplement list
3. Edit `data/food_items.json` to seed the food search pool per meal
4. Build their **Must Avoid** / **Good to Eat** lists in-app (or seed `data/food_preferences.json`)
5. Restart the dev server — all changes take effect immediately

The AI prompt is rebuilt from these files on every analysis call, so the model instantly reflects the updated profile.

---

## Roadmap

- [x] Activity trend charts (daily / weekly / monthly)
- [x] Sectioned activity reports (cardio / strength + muscle map / indoor / badminton)
- [x] Breathing, hydration, and sleep trend insights
- [x] Per-meal next-day food suggestions
- [x] Badminton tracking
- [x] Blood-pressure tracking
- [x] Weight & BMI logging
- [ ] 7/14/30-day overall-score trend charts
- [ ] Weekly digest report (PDF export)
- [ ] Profile switcher UI (multiple users on one instance)
- [ ] Medication reminder push notifications
- [ ] Offline PWA support

---

## Disclaimer

WellnessTrax is an AI-assisted tool for **personal informational purposes only**. It is not a substitute for professional medical or dietetic advice. All AI-generated insights must be verified with your doctor and pharmacist. Always consult your medical team before making changes to your diet, exercise, or medication routine.

---

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**.

You are free to use, modify, and share this code for **personal, non-commercial purposes**.  
You may **not** use this code to build a product or service for which you charge money, or to provide this tool as a commercial service to others.

See [LICENSE](LICENSE) for full terms.

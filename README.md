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
| 2 | **Food Log** | Log breakfast/lunch/dinner/snacks with meal time. **Typeahead search** (from `food_items.json`) adds items, then a quantity/unit picker. A **Meal Planner** (breakfast, lunch & dinner; 3-tab: plate builder + per-100g Foods DB + Notes) lets you build a plate for any chosen day and **Apply** it into that day's meal log |
| 3 | **Activity** | Log gym session with in/out time and auto-calculated duration, exercises with sets/reps/weights, post-prandial walks, soleus pumps, **badminton** (duration/intensity/games), and breathing exercises |
| 4 | **Medications** | Mark each scheduled medication and supplement taken with timestamp. Periodic injectable tracking with auto-calculated next-due status badge |
| 5 | **Blood Work & Vitals** | Log and track **lipid, thyroid, blood-pressure, weight, and daily mood** over time with trend arrows and reference ranges. Thyroid supports **TSH-only panels**; BP captures systolic/diastolic + optional pulse, time of day, and cuff arm; the Weight tab sets a target and shows a **weight-goal panel** (current vs target, BMI, to-go, progress bar); mood is a 10-second circumplex check-in |
| 6 | **Water & Sleep** | Hydration tracker, sleep log (hours, quality, bedtime/wake), **multiple daytime naps**, and **post-lunch dip** + **evening dip** trackers |
| 7 | **Reports** | Run AI analysis; meal-wise balanced-plate donuts (with Nutrition); **sectioned Activity trends** (Overall, Cardio, Strength + body **muscle map**, Indoor, Badminton); **Breathing**, **Hydration**, and **Sleep** trend sections — all with charts and AI insights; a **Blood Work & Vitals trends** panel (history line charts with healthy-zone bands + computed insights for weight, BP, lipids, thyroid & mood); and a date navigator to revisit any past day |

---

## Key Features

### Food logging
- **Typeahead search** — start typing and pick from the pre-defined `food_items.json` pool; already-logged items are shown as crossed-out so you never double-add
- **Quantity + unit picker** — after selecting an item, set the amount with smart default units (g / ml / pieces / cups / tbsp / tsp), auto-guessed from the food name
- **Meal time logging** — record the actual clock time of each meal
- **Balanced-plate categorisation** — every item maps to 5 canonical groups (Complex Carbohydrates, Lean/Plant Proteins, Dietary Fiber, Micronutrients, Essential Lipids)
- **Meal Planner** (Breakfast, Lunch & Dinner views) — a 3-tab tool mirroring meal-planning spreadsheets, parameterised per meal:
  - **Plate** — a **day/date picker** (next 21 days; year is implicit and rolls over automatically; applied/past days drop off) + the meal's fixed slots (breakfast: 7; lunch: 13; dinner: 8). Pick an item per slot from a category dropdown + raw grams; calories/protein/carbs/fibre auto-fill with a **TOTAL / target / plain-words "vs target"** summary
  - **Apply** — hit **Apply** (with a confirmation): the plate is logged into that day's meal entries, the plan is cleared, **and that day disappears from the picker** (so it only moves forward). It's manual — nothing auto-fills, nothing is "frozen"
  - **Kitchen list** — the day's plan as plain text (item + grams), **ordered as a cooking sequence** rather than slot order: items are grouped into prep stages — 🔥 *Start first (slow-cook)* → 🥘 *Vegetables* → 🧂 *Add while cooking* → 🧊 *Ready, just measure & serve* — using each item's category and cooking method (so e.g. fish/grain lead and curd lands last). Includes a **people-eating stepper** that scales the quantities (×2, ×3…) for that list only, and **Send to WhatsApp**, so you can cook from your phone without the laptop
  - **Foods** — the editable per-100g database that powers the dropdowns (add/edit/remove)
  - **Notes** — editable planner notes
  - Each meal has its own config (slots, seeded foods, target) in `lib/meal-planner-config.ts`

### Reports & AI analysis
- **Meal-wise balanced plate** — a donut per meal (breakfast/lunch/dinner/snacks) with a per-meal balance score, missing-group hints, a hover item breakdown, and a per-meal **calories + macros** line
- **Deterministic nutrition** — calories, protein, carbs, and fiber are computed **directly from your planner Foods DB** (`qty_g ÷ 100 × per-100g value`, the same math as the planner's TOTAL PLATE), **not** estimated by AI. The **Nutrition** card (per-meal lines + daily total vs target) shows live as soon as food is logged — no need to run an analysis. Logged items not found in the Foods DB are flagged and excluded from the totals. AI still adds the qualitative highlights/concerns/assessment after Re-analyse
- **Sectioned Activity trends** *(own section)* — daily / weekly / monthly charts and per-section AI insights for:
  - **Overall movement** — stacked gym/walk/soleus/badminton minutes, active-day / gym-day / current-gap tiles, plus an AI synthesis (summary, how your body benefits, activity balance, consistency)
  - **Cardio** — cardio minutes trend
  - **Strength & muscles** — a front + back **body muscle map** shaded by sets worked (teal = worked, amber = not worked), with the exercises that hit each muscle, plus a sets/volume trend
  - **Indoor** — post-meal walks + soleus pumps
  - **Badminton** — minutes + games trend
- **Breathing insights** — daily / weekly / monthly charts of Box 4-4-4-4 and 4-7-8 rounds, plus an AI write-up (summary, what's good, improvements, why it helps your heart, consistency)
- **Hydration trends** — daily / weekly / monthly average-intake bars vs your target line, target-met days, with AI analysis
- **Sleep trends** — average sleep-hours bars vs a 7h target, nights ≥7h, average nap, sleep-quality distribution, post-lunch-dip counts, with AI analysis
- **AI health score** — overall daily score, nutrition highlights/concerns, top wins, and areas to improve
- **Blood Work & Vitals trends & insights** — per-metric **history line charts** with a shaded healthy-zone band and dashed target line, latest-value status tiles, a trend badge (improving / steady / worsening), and a computed plain-language insight for **weight & BMI** (with rate-to-target ETA), **blood pressure** (last-N average, classification, and a morning-vs-evening pattern when times are logged), **lipids** (LDL-focused trend vs the &lt;70 cardiac target, plus HDL/triglycerides/total), **thyroid** (TSH), and **mood** (average + high-stress frequency). All computed deterministically from your history — no AI needed
- **Date navigator** — jump to any previous day and view that day's data and analysis

### Activity & wellness
- **Gym session timing** — log gym in/out time; duration auto-calculated and shown as a pill
- **Gym defaults carry forward** — a new day pre-fills the gym exercises and their weights/reps from your most recent logged gym session; change them and the new values become the default from then on (gym only)
- **Badminton** — log each session's duration, intensity (light/moderate/intense), games, and win/loss
- **Daytime nap tracking** — log **multiple naps per day**, each with start/end times (duration auto-calculated) or manual hours; the day's total feeds sleep trends
- **Breathing exercise tracker** — log Box (4-4-4-4) and Long-Exhale (4-7-8) rounds with progress bars
- **Post-lunch dip** and **evening dip** — track drowsiness/energy dips on a 3-level scale (None / Controllable / Uncontrollable)

### Blood work & vitals
- **Four panels** — Lipid profile, Thyroid profile, **Blood Pressure**, and **Weight**, each with history, trend arrows, and cardiac-patient reference ranges
- **TSH-only thyroid panels** — leave T3/T4 blank when not tested (stored as null, never flagged as out-of-range)
- **Blood pressure** — systolic/diastolic (required) + optional pulse, **time of day** (defaults to now), and **cuff arm (left/right)**, scored against a `<130/80` cardiac target with an interpretation banner
- **Daily mood check-in** — science-backed (circumplex model of affect): 5-level mood (valence), optional energy and stress levels, and a what-influenced-it note; one entry per day with a colour-coded last-14-days strip. Mood and stress are tracked because both directly affect cardiac health
- **Weight** — log weight (kg) over time; **BMI is auto-computed** from your profile height, colour-coded against the healthy range, with the change since the previous reading
- **Weight goal** — set/update a target weight; the Weight tab shows a **goal panel** (current vs target, BMI, "to-go" delta, and a progress bar from your starting weight), and Reports shows the target alongside your current weight

### Medications
- **Time-aware alerts** — missed warnings only appear after the scheduled dose time has passed
- **Injectable tracker** — periodic shots tracked with date and dose, auto-calculated next-due, and a colour-coded status badge; the injectable name is read from your profile

### App
- **Past-date editing** — navigate to any previous day from the sidebar to log or correct data
- **Auto-save** — debounced 900 ms auto-save on every change, no manual save button
- **Data backup** — one-click **📦 Backup** in Reports (a) downloads the JSON archive to this device, and (b) writes it into an external backup folder (default `G:\My Drive\MyApps`, override via `BACKUP_MIRROR_DIR`) **both** as `wellnesstrax-backup-<date>.json` (replacing any older app backup file) **and** as a full mirror of the `data/` folder at `<dest>/data` — overwriting the previous copy. The external write is best-effort: if the drive isn't available the download still happens and the button reports it. Hovering the button shows the **last successful backup** time
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

### Use it on your phone (same WiFi)

The UI is responsive (a slide-in drawer replaces the sidebar on small screens), so it works on a phone — handy for the planner's **Cook mode** checklist in the kitchen.

```bash
npm run dev:lan      # binds to 0.0.0.0 so other devices on your WiFi can reach it
```

Then open `http://<your-laptop-IP>:3000` on the phone (find the IP with `ipconfig` → IPv4). **Security note:** `dev:lan` exposes the app — and your health data — to every device on the network, so run it only when needed; the default `npm run dev` stays localhost-only.

---

## Project Structure

```
wellnesstrax/
├── data/                        # All personal health data — gitignored, local only
│   ├── profile.json             # User profile: age, weight, medications, targets
│   ├── food_rules.json          # Always-encourage rules + supplements + expert panel
│   ├── food_items.json          # Pre-defined food lists per meal (search source)
│   ├── activities.json          # Exercise definitions: gym + daily activities
│   ├── breakfast_foods.json     # Breakfast per-100g DB + notes + target (editable in-app)
│   ├── breakfast_plans.json     # Per-day planned breakfast plates + applied dates
│   ├── lunch_foods.json         # Lunch per-100g DB + notes + target (editable in-app)
│   ├── lunch_plans.json         # Per-day planned lunch plates + applied dates
│   ├── dinner_foods.json        # Dinner per-100g DB + notes + target (editable in-app)
│   ├── dinner_plans.json        # Per-day planned dinner plates + applied dates
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
│   │       ├── backup/           # GET — JSON archive download · POST — mirror data/ to external folder
│   │       ├── bloodwork/        # GET, PUT — blood work history
│   │       ├── injectable-meds/  # GET, PUT — injectable medication history
│   │       ├── profile/          # GET profile.json
│   │       ├── food-rules/       # GET food_rules.json
│   │       ├── food-items/       # GET · PUT add · DELETE remove · PATCH recategorise
│   │       ├── meal-foods/[meal]/ # GET + PUT — per-meal per-100g food DB + notes + target
│   │       ├── meal-plans/[meal]/ # GET + PUT — per-day planned plates + applied dates
│   │       └── activities/       # GET activities.json
│   │
│   ├── components/
│   │   ├── Sidebar.tsx          # Navigation sidebar with completion rings + date navigation
│   │   └── sections/
│   │       ├── Dashboard.tsx       # Overview: rings, missed meds, quick stats, score summary
│   │       ├── FoodLog.tsx         # Meal logging: typeahead search + meal planner
│   │       ├── MealPlanner.tsx     # 3-tab meal planner (plate + Foods DB + Notes), per meal
│   │       ├── ActivityLog.tsx     # Gym + walks + soleus + badminton + breathing
│   │       ├── ActivityTrends.tsx  # Sectioned activity (cardio/strength/indoor/badminton) + breathing trends
│   │       ├── MuscleMap.tsx       # Front+back body muscle map (worked vs untrained, exercise→muscle)
│   │       ├── HydrationTrends.tsx # Hydration trend charts + AI (Reports)
│   │       ├── SleepTrends.tsx     # Sleep trend charts + AI (Reports)
│   │       ├── trends-common.tsx   # Shared trend UI: PeriodToggle, StatTile, bucketing, bar chart
│   │       ├── MedicationLog.tsx   # Med/supplement check-off + injectable tracker
│   │       ├── BloodWork.tsx       # Lipid, thyroid, BP, weight (BMI + goal panel) & mood entry + history
│   │       ├── WaterSleep.tsx      # Hydration + sleep + naps + post-lunch/evening dip
│   │       └── Reports.tsx         # Plate charts + Nutrition + all trend sections + history navigator
│   │
│   ├── lib/
│   │   ├── food-utils.ts         # autoCategory(), resolveCategory(), mapToBalancedPlate()
│   │   │                         # — shared categorisation helpers
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

### `data/activities.json`

Defines available gym exercises and daily activities (post-prandial walks, soleus pumps) with default sets/reps/weights/durations used to pre-populate the activity log.

### `data/bloodwork.json`

Lipid, thyroid, blood-pressure, weight, and mood history (`lipid_profile`, `thyroid_profile`, `bp_readings`, `weight_readings`, `mood_entries`). The thyroid panel supports **TSH-only** entries — leave T3/T4 blank and they are stored as `null` (shown as "not tested", never counted as out-of-range). Blood-pressure readings store systolic/diastolic (required) and an optional pulse. Weight readings store a date + weight in kg; BMI is computed live from your profile height.

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
| `data/activities.json` | ✗ Gitignored | Your exercise definitions |
| `data/bloodwork.json` | ✗ Gitignored | Your lab results |
| `data/injectable_meds.json` | ✗ Gitignored | Your injection history |
| `data/sessions/` | ✗ Gitignored | Your daily logs |
| `.env.local` | ✗ Gitignored | API key |

**No personal details are hardcoded in the source** — the app is fully data-driven from `data/*.json`. **No external data transmission** except the AI analysis call, which sends the day's text log (plus recent food/activity history for trend context) to Groq when you click Generate / Re-analyse. Nothing else leaves your machine.

> ⚠️ **Back up your `data/` folder.** Because the whole folder is gitignored, git is **not** a backup. Use the in-app **📦 Backup** button in Reports — it downloads a full JSON archive **and** writes both that JSON file and a full mirror of the `data/` folder to your external backup folder (default `G:\My Drive\MyApps`, set `BACKUP_MIRROR_DIR` to change it), overwriting the previous copy. Hover the button to see the last successful backup time.

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
- **Sectioned activity analysis** *(when ≥ 2 days of history exist)* — an overall synthesis (summary, how your body benefits, activity balance, consistency) plus per-section insights for **cardio**, **strength** (with muscle-balance notes), **indoor** movement, and **badminton**
- **Breathing trend analysis** — summary, what's good, improvements, cardiovascular benefit, consistency
- **Hydration trend analysis** and **sleep trend analysis** — summary, what's good, improvements, consistency

> The model also generates cardiac-safety, inflammation, medication-adherence, and hydration/sleep daily notes that are retained in each session's data; some are surfaced in their relevant trend sections rather than as standalone cards.

The analyze route assembles context server-side: today's log, your medications and food rules, and a 90-day activity + hydration/sleep rollup. To switch the model, edit `src/app/api/analyze/route.ts`:

```typescript
model: "llama-3.3-70b-versatile",  // or "llama-3.1-8b-instant" for faster/cheaper
```

---

## Adapting for a Different User

WellnessTrax is entirely profile-driven — no hardcoded user details exist in the code.

1. Edit `data/profile.json` with the person's name, age, weight, BMI, medications, and daily targets
2. Edit `data/food_rules.json` with their specific food rules and supplement list
3. Edit `data/food_items.json` to seed the food search pool per meal
4. Restart the dev server — all changes take effect immediately

The AI prompt is rebuilt from these files on every analysis call, so the model instantly reflects the updated profile.

---

## Roadmap

- [x] Activity trend charts (daily / weekly / monthly)
- [x] Sectioned activity reports (cardio / strength + muscle map / indoor / badminton)
- [x] Breathing, hydration, and sleep trend insights
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

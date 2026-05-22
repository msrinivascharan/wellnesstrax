# WellnessTrax — AI-Powered Daily Health Tracker

> A local-first, AI-powered personal health OS.  
> Track food, activity, medications, blood work, sleep, and water — analysed daily by LLaMA 3.3 70B.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Groq](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3%2070B-f97316)
![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)

---

## What it is

WellnessTrax is a **local-first, form-based daily health tracker** built around your personal profile — your medications, health conditions, BMI, daily targets, and doctor-prescribed food rules.

Every day, you log your meals, medications, supplements, gym activity, water intake, and sleep through a clean sidebar interface. At the end of the day, a single click runs a full AI analysis that screens every food item against your medications, scores your adherence, and produces a prioritised action plan for tomorrow.

Your health data never leaves your machine.

---

## App Sections

| # | Section | What you do here |
|---|---------|-----------------|
| 1 | **Dashboard** | Today's at-a-glance snapshot: missed meds alert (time-aware), quick water log, today's score if analysed |
| 2 | **Food Log** | Log breakfast, lunch, dinner, and snacks with meal time. Pick pre-defined items or type anything custom. Balanced plate categorisation (Complex Carbs, Proteins, Micronutrients, Dietary Fiber, Essential Lipids) |
| 3 | **Activity** | Log gym session (in/out time + duration), exercises with sets/reps/weights, post-prandial walks, soleus pumps, and breathing exercises |
| 4 | **Medications** | Mark each scheduled medication and supplement as taken with timestamp. Periodic injectable tracking (e.g. Inclisiran) with next-due status |
| 5 | **Blood Work** | Log and track lipid profile and thyroid panel over time with trend indicators and reference ranges |
| 6 | **Water & Sleep** | Hydration tracker (ml) and sleep log with hours, quality rating, bedtime, and wake time |
| 7 | **Reports** | Run AI analysis, view meal-wise balanced plate donut charts, always-avoid food flagging, blood work trends, and previous day history via calendar |

---

## Key Features

- **Drug-food interaction screening** — every logged food item is checked against the user's full medication list
- **Balanced plate analysis** — each meal scored against 5 canonical plate categories (Complex Carbohydrates, Lean/Plant Proteins, Dietary Fiber, Micronutrients, Essential Lipids)
- **Always-avoid flagging** — food items matching the configured avoid list are highlighted per meal in Reports
- **Time-aware medication alerts** — missed medication warnings only appear after the scheduled dose time has passed
- **Injectable medication tracker** — periodic shots (e.g. Inclisiran) tracked with date given, auto-calculated next due, and status badge
- **Blood work trends** — lipid and thyroid panels tracked over time with traffic-light indicators
- **Gym session timing** — log gym in/out time with auto-calculated session duration
- **Meal time logging** — record the actual time of each meal (breakfast, lunch, dinner, snacks)
- **Auto-categorisation** — food items automatically assigned to the correct food group (handles plurals, compound names, Indian foods)
- **Breathing exercise tracker** — log Box (4-4-4-4) and Long Exhale (4-7-8) breathing rounds with progress bars
- **Session history calendar** — browse any past day's data in Reports
- **Auto-save** — debounced 900ms auto-save on every change, no manual save button
- **Data backup** — one-click download of all config files + last 30 sessions as a single JSON archive
- **Fully local** — no database, no cloud sync, no account required
- **Pluggable profile** — swap `data/profile.json` to adapt for any user without touching code

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| AI | Groq API — LLaMA 3.3 70B Versatile |
| AI Client | OpenAI SDK (pointed at Groq's OpenAI-compatible endpoint) |
| Storage | Local JSON files (`data/sessions/`) |
| Date utilities | date-fns |
| UI helpers | clsx |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com/keys) (no credit card, free tier gives 14,400 req/day)

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

### 3. Install dependencies

```bash
npm install
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> The app creates `data/sessions/` automatically on first use.

---

## Project Structure

```
wellnesstrax/
├── data/                        # All config and session data (JSON)
│   ├── profile.json             # User profile: age, weight, medications, targets
│   ├── food_rules.json          # Always-avoid and always-encourage food rules
│   ├── food_items.json          # Pre-defined food item lists per meal (edit freely)
│   ├── activities.json          # Exercise definitions: gym + daily activities
│   ├── bloodwork.json           # Blood work history (lipid + thyroid panels)
│   ├── injectable_meds.json     # Periodic injectable medication history
│   └── sessions/                # Daily logs — gitignored, stays on your machine
│       └── YYYY-MM-DD.json
│
├── src/
│   ├── app/
│   │   ├── page.tsx             # Root page: loads profile, builds empty log, mounts layout
│   │   └── api/
│   │       ├── analyze/         # POST — runs Groq AI analysis on today's log
│   │       ├── sessions/        # GET list / POST new session
│   │       ├── sessions/[date]/ # GET, PUT, DELETE a specific day's session
│   │       ├── backup/          # GET — returns all data as downloadable JSON archive
│   │       ├── bloodwork/       # GET, PUT — blood work history
│   │       ├── injectable-meds/ # GET, PUT — injectable medication history
│   │       ├── profile/         # GET profile.json
│   │       ├── food-rules/      # GET food_rules.json
│   │       ├── food-items/      # GET + PUT food_items.json
│   │       └── activities/      # GET activities.json
│   │
│   ├── components/
│   │   ├── Sidebar.tsx          # Navigation sidebar with completion rings
│   │   └── sections/
│   │       ├── Dashboard.tsx    # Overview: missed meds, quick stats
│   │       ├── FoodLog.tsx      # Meal logging with balanced plate chips + meal time
│   │       ├── ActivityLog.tsx  # Gym + walks + soleus pump + breathing
│   │       ├── MedicationLog.tsx# Med + supplement check-off + injectable tracker
│   │       ├── BloodWork.tsx    # Lipid and thyroid panel tracking
│   │       ├── WaterSleep.tsx   # Hydration + sleep logging
│   │       └── Reports.tsx      # Charts + AI analysis + history calendar
│   │
│   ├── lib/
│   │   ├── food-utils.ts        # autoCategory(), resolveCategory(), mapToBalancedPlate(),
│   │   │                        # checkAlwaysAvoidRules() — shared food helpers
│   │   ├── prompt-builder.ts    # Builds the full AI analysis prompt from today's log
│   │   ├── profile-loader.ts    # Reads profile.json and food_rules.json
│   │   └── session-store.ts     # Read/write/list daily session JSON files
│   │
│   └── types/
│       └── index.ts             # All TypeScript interfaces (DayLog, DayAnalysis, etc.)
│
├── .env.example                 # Safe to commit — contains only placeholder key
├── .gitignore                   # Excludes .env.local, data/sessions/, node_modules
└── package.json
```

---

## Configuration Files

### `data/profile.json`

Contains the user's medical and nutritional profile. Key fields:

```json
{
  "name": "...",
  "age": 45,
  "weight_kg": 85,
  "bmi": 29,
  "cardiac_status": "...",
  "medications": [
    {
      "name": "Medication Name",
      "dose": "90mg",
      "time": "9AM and 9PM",
      "condition": "Condition description",
      "interactions": ["food1", "food2"]
    }
  ],
  "daily_targets": {
    "calories": 1800,
    "protein_g": 120,
    "fiber_g": 35,
    "water_ml": 3000
  }
}
```

Medications with `"time": "9AM and 9PM"` are automatically split into two separate daily entries.

### `data/food_rules.json`

Doctor/dietitian approved rules loaded into every AI analysis:

- `always_avoid` — hard no's (specific interactions, harmful ingredients)
- `always_encourage` — foods to favour
- `supplements_to_track` — prescribed supplements with timing
- `expert_panel` — reference nutritionist personas for the AI's framing context

### `data/food_items.json`

Pre-defined food item lists shown as quick-pick chips in Food Log. Organised by meal → category → item name. Edit this file freely to add, remove, or reorganise items — the app loads it fresh on every page load.

```json
{
  "meals": {
    "breakfast": {
      "Fruits": ["Blueberries", "Guava", "Avocado"],
      "Nuts & Seeds": ["Groundnuts", "Walnuts"],
      "Dietary Fiber": ["Psyllium husk"]
    }
  }
}
```

### `data/activities.json`

Defines available gym exercises and daily activities (walks, soleus pumps). Each exercise includes default sets, reps, weights, or durations used to pre-populate the activity log.

---

## Data & Privacy

- **Sessions** are saved to `data/sessions/YYYY-MM-DD.json` — excluded from git via `.gitignore`
- **API keys** live only in `.env.local` — never committed
- **No external data transmission** except the AI analysis call (today's log text is sent to Groq)
- The profile in this repo uses anonymised placeholder data. Replace with real data locally — it will never be committed if you keep it in `data/profile.json` and are careful with git

> **Recommendation**: Back up `data/sessions/` periodically to an encrypted cloud folder or use the in-app **Backup** button which downloads a full archive.

---

## AI Analysis Details

**Model**: `llama-3.3-70b-versatile` via Groq  
**Free tier**: 14,400 requests/day (~2 used per day with this app)  
**Typical response time**: 10–25 seconds  
**Output format**: Structured JSON (enforced via `response_format: { type: "json_object" }`)

### What the AI analyses

- Estimated macros (calories, protein, fiber) from logged food
- Drug-food interaction alerts with severity levels (CRITICAL / HIGH / MEDIUM / LOW)
- Medication adherence score
- Health safety assessment based on profile conditions
- Inflammation balance (pro vs anti-inflammatory food choices)
- Hydration and sleep quality assessment
- Foods to permanently avoid (always 2–5 items, even on clean-log days)
- Personalised additions for tomorrow
- Top wins, areas to improve, tomorrow's action focus

To switch the model, edit `src/app/api/analyze/route.ts`:
```typescript
model: "llama-3.3-70b-versatile",  // or "llama-3.1-8b-instant" for faster/cheaper
```

---

## Adapting for a Different User

WellnessTrax is designed to be profile-driven. The code has no hardcoded user details.

1. Edit `data/profile.json` with the new person's name, age, weight, BMI, medications, and daily targets
2. Edit `data/food_rules.json` with their specific food rules and supplement list
3. Edit `data/food_items.json` to add their preferred foods
4. Restart the dev server — all changes take effect immediately

The AI prompt is rebuilt from these files on every analysis call, so the analysis will instantly reflect the new profile.

---

## Roadmap

- [ ] 7/14/30-day score trend charts
- [ ] Weekly digest report (PDF export)
- [ ] Profile switcher UI (multiple users on one instance)
- [ ] Medication reminder push notifications
- [ ] Weight and BMI trend logging
- [ ] Shareable daily summary card (image export)
- [ ] Offline PWA support

---

## Disclaimer

WellnessTrax is an AI-assisted tool for **personal informational purposes only**. It is not a substitute for professional medical or dietetic advice. Drug-food interaction alerts are AI-generated and must be verified with your doctor and pharmacist. Always consult your medical team before making changes to your diet or medication routine.

---

## License

This project is licensed under the **PolyForm Noncommercial License 1.0.0**.

You are free to use, modify, and share this code for **personal, non-commercial purposes**.  
You may **not** use this code to build a product or service for which you charge money, or to provide this tool as a commercial service to others.

See [LICENSE](LICENSE) for full terms.

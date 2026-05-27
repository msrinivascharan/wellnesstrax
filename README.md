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

Your health data never leaves your machine (except the anonymised log text sent to Groq for AI analysis).

---

## App Sections

| # | Section | What you do here |
|---|---------|-----------------|
| 1 | **Dashboard** | Today's at-a-glance snapshot: missed meds alert (time-aware), quick water log, today's score if analysed |
| 2 | **Food Log** | Log breakfast/lunch/dinner/snacks with meal time. Quick-pick pre-defined chips organised by category. Custom items auto-categorised. Must Avoid / Good to Eat reference lists. Full chip editor (delete, recategorise) |
| 3 | **Activity** | Log gym session with in/out time and auto-calculated duration, exercises with sets/reps/weights, post-prandial walks, soleus pumps, and breathing exercises |
| 4 | **Medications** | Mark each scheduled medication and supplement as taken with timestamp. Periodic injectable tracking (e.g. Inclisiran) with next-due status badge |
| 5 | **Blood Work** | Log and track lipid profile and thyroid panel over time with trend indicators and reference ranges |
| 6 | **Water & Sleep** | Hydration tracker (ml) and sleep log with hours, quality rating, bedtime/wake time, and daytime nap with start/end times |
| 7 | **Reports** | Run AI analysis, view meal-wise balanced plate donut charts with hover item breakdown, avoid-list flagging, blood work trends, and previous day history via calendar |

---

## Key Features

### Food Logging
- **Pre-defined chip lists** — quick-pick items organised by meal and category
- **Edit list mode** — delete chips and move them to a different category without leaving the app
- **Must Avoid list** — personal items to never eat; flagged automatically in Reports
- **Good to Eat list** — items always worth including; both lists editable in real time
- **Auto-categorisation** — custom items automatically assigned to the correct food group (handles plurals, compound names, Indian foods, oils vs vegetables)
- **Meal time logging** — record the actual clock time of each meal (breakfast, lunch, dinner, snacks)
- **Balanced plate categorisation** — all items mapped to 5 canonical categories (Complex Carbohydrates, Lean/Plant Proteins, Dietary Fiber, Micronutrients, Essential Lipids)

### Analysis & Reports
- **Hover item breakdown** — hover any category on the meal-wise donut legend to see exactly which foods contributed to it
- **Dual avoid-list flagging** — food items checked against both `food_rules.json` (complex rules) and the user-editable Must Avoid list
- **Drug-food interaction screening** — every logged food item checked against the user's full medication list
- **Always-avoid flagging** — food items matching configured avoid rules highlighted per meal
- **AI health score** — overall daily score with macro estimates, adherence scoring, and personalised recommendations
- **Session history calendar** — browse and analyse any past day's data in Reports

### Activity & Wellness
- **Gym session timing** — log gym in/out time; duration auto-calculated and shown as a pill
- **Daytime nap tracking** — log nap start/end times; duration auto-calculated (mirrors night-sleep UX)
- **Breathing exercise tracker** — log Box (4-4-4-4) and Long Exhale (4-7-8) breathing rounds with progress bars

### Medications
- **Time-aware medication alerts** — missed warnings only appear after the scheduled dose time has passed
- **Injectable medication tracker** — periodic shots tracked with date, dose, auto-calculated next-due, and colour-coded status badge

### App
- **Past date editing** — navigate to any previous day from the sidebar to log missed data
- **Auto-save** — debounced 900 ms auto-save on every change, no manual save button
- **Data backup** — one-click download of all config + last 30 sessions as a single JSON archive
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
├── data/                        # Config and session data (JSON)
│   ├── profile.json             # User profile: age, weight, medications, targets
│   ├── food_rules.json          # Avoid/encourage rules + supplements + expert panel
│   ├── food_items.json          # Pre-defined food chip lists per meal (edit freely)
│   ├── food_preferences.json    # Must Avoid / Good to Eat personal lists (edit in-app)
│   ├── activities.json          # Exercise definitions: gym + daily activities
│   ├── bloodwork.json           # Blood work history (gitignored — add your own locally)
│   ├── injectable_meds.json     # Injectable medication history (gitignored — add locally)
│   └── sessions/                # Daily logs — gitignored, stays on your machine
│       └── YYYY-MM-DD.json
│
├── src/
│   ├── app/
│   │   ├── page.tsx             # Root page: loads all data, mounts layout, wires handlers
│   │   └── api/
│   │       ├── analyze/         # POST — runs Groq AI analysis on the day's log
│   │       ├── sessions/        # GET list of available session dates
│   │       ├── sessions/[date]/ # GET, PUT, DELETE a specific day's session
│   │       ├── backup/          # GET — downloads all data as a JSON archive
│   │       ├── bloodwork/       # GET, PUT — blood work history
│   │       ├── injectable-meds/ # GET, PUT — injectable medication history
│   │       ├── profile/         # GET profile.json
│   │       ├── food-rules/      # GET food_rules.json
│   │       ├── food-items/      # GET list · PUT add item · DELETE remove · PATCH move to new category
│   │       ├── food-preferences/# GET + PUT — Must Avoid / Good to Eat lists
│   │       └── activities/      # GET activities.json
│   │
│   ├── components/
│   │   ├── Sidebar.tsx          # Navigation sidebar with completion rings + date navigation
│   │   └── sections/
│   │       ├── Dashboard.tsx    # Overview: missed meds, quick stats, score summary
│   │       ├── FoodLog.tsx      # Meal logging: chips, custom input, edit list, pref lists
│   │       ├── ActivityLog.tsx  # Gym (in/out/duration) + walks + soleus + breathing
│   │       ├── MedicationLog.tsx# Med/supplement check-off + injectable tracker
│   │       ├── BloodWork.tsx    # Lipid and thyroid panel entry + history
│   │       ├── WaterSleep.tsx   # Hydration tracker + sleep + daytime nap
│   │       └── Reports.tsx      # Balanced plate charts + AI analysis + history calendar
│   │
│   ├── lib/
│   │   ├── food-utils.ts        # autoCategory(), resolveCategory(), mapToBalancedPlate(),
│   │   │                        # checkAlwaysAvoidRules() — shared categorisation helpers
│   │   ├── prompt-builder.ts    # Builds the full AI analysis prompt from today's log
│   │   ├── profile-loader.ts    # Reads/writes all data/*.json config files
│   │   └── session-store.ts     # Read/write/list daily session JSON files
│   │
│   └── types/
│       └── index.ts             # All TypeScript interfaces (DayLog, DayAnalysis, etc.)
│
├── .env.example                 # Safe to commit — contains only placeholder key
├── .gitignore                   # Excludes .env.local, sessions/, bloodwork.json, injectable_meds.json
└── package.json
```

---

## Configuration Files

### `data/profile.json`

Contains the user's medical and nutritional profile. This is the main file to edit when adapting the app for a different person. Key fields:

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
  "daily_targets": {
    "calories": 1800,
    "protein_g": 120,
    "fiber_g": 35,
    "water_ml": 3000
  }
}
```

Medications with `"time": "9AM and 9PM"` are automatically split into two daily entries. Medications without a `time` field (e.g. injectables) are skipped from the daily check-off list.

### `data/food_rules.json`

Doctor/dietitian approved rules loaded into every AI analysis:

- `always_avoid` — hard no's (specific interactions, harmful ingredients)
- `always_encourage` — foods to favour
- `supplements_to_track` — prescribed supplements with timing and targets
- `expert_panel` — reference nutritionist personas used to frame AI context

Items in `always_avoid` are checked against every logged meal in Reports and flagged with a warning badge.

### `data/food_items.json`

Pre-defined food item lists shown as quick-pick chips in the Food Log. Organised by `meal → category → [items]`. Edit freely — the app reloads on save. Items can also be added, deleted, and recategorised directly from the app's Edit list mode.

```json
{
  "meals": {
    "breakfast": {
      "Fruits":        ["Blueberries", "Guava", "Avocado"],
      "Nuts & Seeds":  ["Groundnuts", "Walnuts"],
      "Dietary Fiber": ["Psyllium husk"]
    },
    "lunch": { ... },
    "dinner": { ... },
    "snacks": { ... }
  }
}
```

### `data/food_preferences.json`

User-editable personal food preference lists managed from within the Food Log section. No restart needed — changes save immediately via the API.

```json
{
  "avoid":    ["Carbonated beverages", "Fried foods"],
  "encourage": ["Olive oil", "Blueberries"]
}
```

- `avoid` items are cross-checked against every meal in Reports and highlighted in red, including inside the hover item breakdown.
- `encourage` items appear as green "Good to Eat" chips — a visual reminder.

### `data/activities.json`

Defines available gym exercises and daily activities (post-prandial walks, soleus pumps). Each gym exercise includes default sets, reps, weights, or durations used to pre-populate the activity log. Add, remove, or rename exercises here; changes take effect immediately.

### `data/bloodwork.json` *(gitignored — add locally)*

Blood work history. Kept out of version control since it contains real medical data. The repo ships an empty template. Add your own lipid panel and thyroid results; the Reports section will display them with traffic-light indicators and trend history.

### `data/injectable_meds.json` *(gitignored — add locally)*

Injectable medication history. Add dose records here; the Medications section shows the latest dose date, calculates next-due automatically, and displays a colour-coded status badge.

---

## Data & Privacy

| File | Committed? | Contains |
|------|-----------|---------|
| `data/profile.json` | ✓ Yes | Anonymised example profile |
| `data/food_rules.json` | ✓ Yes | Example food/drug rules |
| `data/food_items.json` | ✓ Yes | Example food chip lists |
| `data/food_preferences.json` | ✓ Yes | Example avoid/encourage lists |
| `data/activities.json` | ✓ Yes | Exercise definitions |
| `data/bloodwork.json` | ✗ Gitignored | Real medical lab data |
| `data/injectable_meds.json` | ✗ Gitignored | Real injection history |
| `data/sessions/` | ✗ Gitignored | Real daily logs |
| `.env.local` | ✗ Gitignored | API key |

**No external data transmission** except the AI analysis call — today's text log is sent to Groq when you click Generate. Nothing else leaves your machine.

> **Backup recommendation**: Use the in-app **📦 Backup** button in Reports to download a full archive. Keep `data/bloodwork.json`, `data/injectable_meds.json`, and `data/sessions/` backed up separately (encrypted cloud folder, external drive, etc.).

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
- Foods to permanently avoid (from today's log and known interactions)
- Personalised additions for tomorrow
- Top wins, areas to improve, tomorrow's action focus

To switch the model, edit `src/app/api/analyze/route.ts`:
```typescript
model: "llama-3.3-70b-versatile",  // or "llama-3.1-8b-instant" for faster/cheaper
```

---

## Adapting for a Different User

WellnessTrax is entirely profile-driven — no hardcoded user details exist in the code.

1. Edit `data/profile.json` with the person's name, age, weight, BMI, medications, and daily targets
2. Edit `data/food_rules.json` with their specific food rules and supplement list
3. Edit `data/food_items.json` to add their preferred foods per meal
4. Edit `data/food_preferences.json` or use the in-app Must Avoid / Good to Eat lists
5. Restart the dev server — all changes take effect immediately

The AI prompt is rebuilt from these files on every analysis call, so the model will instantly reflect the updated profile.

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

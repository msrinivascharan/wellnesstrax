# NutriBot — Daily Nutrition Intelligence

AI-powered cardiac-safe daily nutrition tracking. An affordable, interactive alternative to a dietitian — built around your exact health profile.

## What it does

- **Conversational meal logging** — bot walks you through each meal one at a time
- **Mode A (Morning)** — plan review before you eat: verdicts, drug-food checks, timing advice
- **Mode B (Evening)** — full audit: macro maps, micro intel, 4 expert panel scores, drug safety, tomorrow's blueprint
- **Drug-food safety** — every meal screened against your 5 medications
- **4 AI expert personas** — Ryan Fernando, Rujuta Diwekar, Dr. Huberman, Bryan Johnson
- **Cardiac safety rating** — non-negotiable ≥85 target, flagged immediately if breached
- **Local JSON storage** — sessions saved to `data/sessions/YYYY-MM-DD.json`, backup to cloud anytime
- **Pluggable profile** — swap `data/profile.json` for any user without touching code

## Quick Start

### 1. Get a free Groq API key
Go to [console.groq.com/keys](https://console.groq.com/keys) → Create API Key (free, no credit card needed)

### 2. Set up the environment
```bash
cd C:\SpaceS\nutribot
copy .env.example .env.local
# Edit .env.local and paste your Groq API key
```

Your `.env.local` should look like:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Install dependencies
```bash
npm install
```

### 4. Run the app
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Plugging in a different health profile

All user data lives in two files — never inside the code:

| File | What it contains |
|------|-----------------|
| `data/profile.json` | Name, age, weight, medications, exercise, score targets |
| `data/food_rules.json` | Food rules, expert panel, supplements to track |

To use NutriBot for another person (spouse, family member):
1. Create a copy of `data/profile.json` — e.g. `data/profile_spouse.json`
2. Edit it with their details
3. Rename it to `data/profile.json` when switching

A profile switcher UI is on the Phase 2 roadmap.

---

## Session data

Sessions are saved as JSON in `data/sessions/`:
```
data/sessions/
  2026-05-20.json
  2026-05-21.json
  ...
```

Each file contains the full meal log + AI analysis for that day.
Back these up to OneDrive, Google Drive, or any cloud storage.
They are excluded from git (`.gitignore`) to protect your health data.

---

## AI Model

Uses **Groq LLaMA 3.3 70B** — the most capable free model available.
- Free tier: 14,400 requests/day (you'll use ~2/day)
- Response time: typically 10–25 seconds for full analysis

To change the model, edit `src/app/api/analyze/route.ts`:
```typescript
model: "llama-3.3-70b-versatile",  // change this
```

Available Groq models: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`

---

## Phase 2 Roadmap

- Score trend charts (7/14/30 day graphs)
- Weekly digest report
- Session history page with timeline
- Profile switcher UI
- Export to PDF
- Medication timing reminders
- Indian food autocomplete

---

## Disclaimer

NutriBot is an AI tool for informational purposes only. It is not a substitute for professional medical or dietetic advice. Always consult your cardiologist and dietitian before making significant changes to your diet or medications.

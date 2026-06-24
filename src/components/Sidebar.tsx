"use client";
import { format } from "date-fns";
import type { DayLog, UserProfile } from "@/types";

export type SectionId = "dashboard" | "food" | "activity" | "medications" | "bloodwork" | "water-sleep" | "reports";

interface NavItem {
  id: SectionId;
  label: string;
  icon: string;
  desc: string;
}

const NAV: NavItem[] = [
  { id: "dashboard",   label: "Dashboard",    icon: "🏠", desc: "Today at a glance" },
  { id: "food",        label: "Food Log",     icon: "🍽️", desc: "Meals & nutrition" },
  { id: "activity",    label: "Activity",     icon: "🏃", desc: "Gym & movement" },
  { id: "medications", label: "Medications",  icon: "💊", desc: "Meds & supplements" },
  { id: "bloodwork",   label: "Blood Work & Vitals", icon: "🩸", desc: "Labs, vitals & mood" },
  { id: "water-sleep", label: "Water & Sleep",icon: "💧", desc: "Hydration & rest" },
  { id: "reports",     label: "Reports",      icon: "📊", desc: "AI insights" },
];

// ─── Completion helpers ───────────────────────────────────────────────────────

function ringColor(pct: number) {
  if (pct >= 80) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function MiniRing({ pct, color }: { pct: number; color: string }) {
  const r = 9; const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  return (
    <svg width="22" height="22" className="shrink-0" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r={r} className="ring-track" strokeWidth="2.5" />
      <circle
        cx="11" cy="11" r={r}
        className="ring-fill"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

function computeCompletion(log: DayLog | null, profile: UserProfile | null) {
  if (!log || !profile) return { food: 0, water: 0, meds: 0, activity: 0, sleep: 0 };

  const totalFood = Object.values(log.food).flat().length;
  const foodPct = Math.min(100, (totalFood / 6) * 100);

  const waterTarget = profile.daily_targets.water_ml || 3000;
  const waterPct = Math.min(100, (log.water_ml / waterTarget) * 100);

  const totalMeds = log.medications.length + log.supplements.length;
  const takenMeds = log.medications.filter(m => m.taken).length + log.supplements.filter(s => s.taken).length;
  const medsPct = totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;

  const gymDone = log.activity.gym.did_gym ? 50 : 0;
  const walksDone = Math.min(50, (log.activity.post_prandial_walks.length / 3) * 50);
  const activityPct = Math.min(100, gymDone + walksDone);

  const sleepPct = log.sleep.hours >= 7 ? 100 : log.sleep.hours > 0 ? Math.round((log.sleep.hours / 7) * 100) : 0;

  return { food: Math.round(foodPct), water: Math.round(waterPct), meds: medsPct, activity: Math.round(activityPct), sleep: sleepPct };
}

function sectionCompletion(id: SectionId, c: ReturnType<typeof computeCompletion>) {
  switch (id) {
    case "food":        return c.food;
    case "water-sleep": return Math.round((c.water + c.sleep) / 2);
    case "medications": return c.meds;
    case "activity":    return c.activity;
    default:            return -1;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  active: SectionId;
  onNavigate: (s: SectionId) => void;
  dayLog: DayLog | null;
  profile: UserProfile | null;
  saveStatus: "saved" | "saving" | "error" | "idle";
  selectedDate: string;
  onDateChange: (date: string) => void;
  /** Mobile drawer: whether it's open, and a close callback */
  open?: boolean;
  onClose?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({ active, onNavigate, dayLog, profile, saveStatus, selectedDate, onDateChange, open = false, onClose }: SidebarProps) {
  const completion = computeCompletion(dayLog, profile);
  const todayStr   = format(new Date(), "yyyy-MM-dd");
  const isToday    = selectedDate === todayStr;
  const viewDate   = new Date(selectedDate + "T12:00:00");
  const isSunday   = viewDate.getDay() === 0;

  function goPrev() {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    onDateChange(format(d, "yyyy-MM-dd"));
  }

  function goNext() {
    if (isToday) return;
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const next = format(d, "yyyy-MM-dd");
    if (next <= todayStr) onDateChange(next);
  }

  return (
    <aside
      className={`shrink-0 flex flex-col h-screen border-r fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      style={{ width: 230, background: "var(--bg-sidebar)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
            style={{ background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)" }}
          >
            🧬
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white tracking-tight">WellnessTrax</div>
            <div className="text-xs" style={{ color: "#475569" }}>Smart wellness tracker</div>
          </div>
          {/* Mobile-only close button */}
          <button onClick={onClose} aria-label="Close menu"
            className="lg:hidden ml-auto w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-lg"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "#94a3b8" }}>
            ✕
          </button>
        </div>
      </div>

      {/* ── Date navigation ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b space-y-1.5" style={{ borderColor: "var(--border)" }}>

        {/* ‹ Date › row */}
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            title="Previous day"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: "#64748b" }}>
            ‹
          </button>

          {/* Clickable date label — opens native date picker */}
          <label className="flex-1 relative cursor-pointer select-none">
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={e => { if (e.target.value) onDateChange(e.target.value); }}
              style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", cursor: "pointer" }}
            />
            <div className="text-xs font-semibold text-center text-white py-0.5">
              {format(viewDate, "EEE, dd MMM yyyy")}
            </div>
            <div className="text-center" style={{ fontSize: 9, color: "#334155" }}>tap to pick date</div>
          </label>

          <button
            onClick={goNext}
            disabled={isToday}
            title={isToday ? "Already on today" : "Next day"}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: isToday ? "#1e3050" : "#64748b",
              cursor: isToday ? "not-allowed" : "pointer",
            }}>
            ›
          </button>
        </div>

        {/* Back to Today — only when viewing a past date */}
        {!isToday && (
          <button
            onClick={() => onDateChange(todayStr)}
            className="w-full text-xs py-1.5 rounded-lg font-medium transition-all"
            style={{ background: "rgba(20,184,166,0.1)", color: "#14b8a6", border: "1px solid rgba(20,184,166,0.25)" }}>
            ↩ Back to Today
          </button>
        )}

        {isSunday && isToday && (
          <div className="text-xs" style={{ color: "#f59e0b" }}>☀️ Rest day — flexible choices</div>
        )}

        {profile && (
          <div className="text-xs" style={{ color: "#475569" }}>
            {profile.display_name} · {profile.weight_kg}kg · BMI {profile.bmi}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const pct = sectionCompletion(item.id, completion);
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onClose?.(); }}
              className={`nav-item w-full text-left ${isActive ? "active" : ""}`}
            >
              <span className="text-base leading-none shrink-0">{item.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{item.label}</span>
                {!isActive && (
                  <span className="block text-xs truncate" style={{ color: "#334155" }}>{item.desc}</span>
                )}
              </span>
              {pct >= 0 && (
                <MiniRing pct={pct} color={ringColor(pct)} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Save status + profile footer */}
      <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5 text-xs">
          {saveStatus === "saving" && (
            <>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span style={{ color: "#475569" }}>Saving…</span>
            </>
          )}
          {saveStatus === "saved" && (
            <span style={{ color: "#22c55e" }}>✓ All changes saved</span>
          )}
          {saveStatus === "error" && (
            <span style={{ color: "#ef4444" }}>⚠ Save failed — check connection</span>
          )}
        </div>
        {profile && (
          <div className="text-xs" style={{ color: "#334155" }}>
            <span className="block">← data/profile.json</span>
          </div>
        )}
      </div>
    </aside>
  );
}

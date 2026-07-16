import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, ReferenceLine,
} from "recharts";

/* ============================================================
   BUCS 610 — personal powerlifting performance platform
   Preloaded with the athlete's programme, working weights,
   progression rules, injury flags and BUCS 2027 targets.
   Data persists via window.storage.
   ============================================================ */

const STORE_KEY = "bucs610:data:v1";
const BACKUP_KEY = "bucs610:backups:v1";
const MEET_DATE = new Date("2027-03-01T09:00:00");

const TARGETS = { squat: 225, bench: 145, deadlift: 240, total: 610 };
const BASELINE = { squat: 160, bench: 93, deadlift: 200 };

// IPF plate colours
const PLATES = [
  { kg: 25, color: "#E23D3D", h: 46 },
  { kg: 20, color: "#2E6FE0", h: 46 },
  { kg: 15, color: "#E8B93B", h: 40 },
  { kg: 10, color: "#3DA35D", h: 34 },
  { kg: 5, color: "#EDECE8", h: 26 },
  { kg: 2.5, color: "#8A8A94", h: 20 },
  { kg: 1.25, color: "#5A5A64", h: 16 },
];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const PROGRAM = {
  mon: {
    title: "Heavy Bench",
    sub: "Off-chest strength + upper back",
    exercises: [
      { name: "Paused Bench", w: 70, sets: 4, reps: 4, lift: "bench", main: true, cue: "3-count pause, COMP-width grip. Film the left side." },
      { name: "Low Pin Press", w: 65, sets: 4, reps: 3, lift: "bench", cue: "Pins at chest height. Dead stop every rep — this is your weakness." },
      { name: "Static Hold", w: 115, sets: 3, reps: 1, cue: "10–15s unrack holds. Builds stabilisers toward 145." },
      { name: "Barbell Row", w: 60, sets: 4, reps: 8, cue: "Upper back = your bench platform AND deadlift lockout. New priority." },
      { name: "Face Pull", w: 25, sets: 3, reps: 15, cue: "Left rear delt priority." },
    ],
  },
  tue: {
    title: "Deadlift + Grip",
    sub: "Heavy pulls are back — grip trains in parallel",
    exercises: [
      { name: "Deadlift (top sets)", w: 150, sets: 3, reps: 3, lift: "deadlift", main: true, cue: "Mixed or hook grip. This drives the lift — grip no longer caps it." },
      { name: "Deadlift DOH back-off", w: 120, sets: 2, reps: 3, doh: true, cue: "Bar at finger base. Chalk. This is where grip gets built." },
      { name: "Romanian Deadlift", w: 80, sets: 3, reps: 8, cue: "Straps allowed here." },
      { name: "Single-Arm DB Row", w: 26, sets: 3, reps: 10, cue: "LEFT hand first. Right only matches what left achieved." },
      { name: "Plate Pinch", w: 10, sets: 3, reps: 1, cue: "To failure each hand. Log seconds in notes." },
      { name: "Dead Hang", w: 0, sets: 3, reps: 1, cue: "Target: beat 11s." },
    ],
  },
  wed: {
    title: "Squat Volume",
    sub: "Tendon loading day 1 of 2 — knee protocol mandatory",
    exercises: [
      { name: "High Bar Squat", w: 100, sets: 4, reps: 5, lift: "squat", main: true, cue: "Shoes + sleeves ON. 3s eccentric on first 2 sets — that's rehab AND strength. Pain >3 = stop." },
      { name: "Leg Press", w: 150, sets: 3, reps: 10, cue: "60° depth max — protect the knee." },
      { name: "Prone Ham Curl", w: 32, sets: 3, reps: 10, cue: "" },
      { name: "Wall Sit", w: 0, sets: 4, reps: 1, cue: "30s → building to 45s. Isometric knee protocol." },
      { name: "Single-Leg Decline Eccentric", w: 0, sets: 3, reps: 8, cue: "4s lower on LEFT, stand with right." },
    ],
  },
  thu: {
    title: "Bench Volume",
    sub: "Chest activation + left side",
    exercises: [
      { name: "Spoto Press", w: 75, sets: 4, reps: 5, lift: "bench", cue: "1 inch off chest, dead pause." },
      { name: "Close Grip Bench", w: 60, sets: 3, reps: 8, lift: "bench", cue: "" },
      { name: "DB Bench (paused)", w: 20, sets: 3, reps: 10, cue: "Each arm carries itself — left can't hide behind the bar. Chest focus." },
      { name: "Overhead Tricep Ext", w: 15, sets: 3, reps: 12, cue: "" },
      { name: "Lat Pulldown", w: 57, sets: 3, reps: 10, cue: "" },
      { name: "Band Pull-Aparts", w: 0, sets: 5, reps: 20, cue: "Every bench day, no exceptions." },
    ],
  },
  fri: {
    title: "Comp Bench + Squat 2",
    sub: "Meet simulation: bench then squat, like game day",
    exercises: [
      { name: "Comp Bench", w: 80, sets: 3, reps: 2, lift: "bench", main: true, cue: "WIDE grip, full comp setup, self-commands. Film from foot end." },
      { name: "Paused Back-off", w: 72.5, sets: 2, reps: 4, lift: "bench", cue: "Quality volume at comp grip." },
      { name: "Walkout Hold", w: 120, sets: 2, reps: 1, cue: "10s. Own the weight before you squat." },
      { name: "Squat (moderate)", w: 85, sets: 3, reps: 5, lift: "squat", rpe: 6.5, cue: "Second weekly tendon exposure. Crisp technique, RPE 6-7 max." },
      { name: "Cable External Rotation", w: 7.5, sets: 3, reps: 15, cue: "Left shoulder priority." },
    ],
  },
};

const REST_DAYS = { sat: "Rest — shifts, food, sleep", sun: "Rest — prep the week" };

const DEFAULT_ACTIONS = [
  { id: "physio", text: "Book university physio (knee + shoulder) — MOST URGENT", done: false },
  { id: "bag", text: "Shoes + knee sleeves live in gym bag permanently", done: false },
  { id: "gp", text: "GP follow-up — push for physio referral", done: false },
  { id: "mfp", text: "Start MyFitnessPal daily logging", done: false },
  { id: "towel", text: "Towel in bag for towel pulldowns", done: false },
  { id: "pinch", text: "Daily plate pinches at home", done: false },
  { id: "ring", text: "Buy grip ring / Gripmaster for shifts", done: false },
  { id: "film", text: "Film deadlift set from the side", done: false },
];

/* ---------- helpers ---------- */

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtShort = (d) => {
  const dt = new Date(d + "T00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// RPE-adjusted Epley
function e1rm(w, reps, rpe) {
  if (!w || !reps) return 0;
  const rir = rpe ? Math.max(0, 10 - rpe) : 0;
  const eff = reps + rir;
  if (eff <= 1) return w;
  return Math.round(w * (1 + eff / 30) * 2) / 2;
}

function bestE1rmForLift(sessions, lift) {
  let best = 0;
  sessions.forEach((s) =>
    s.exercises.forEach((ex) => {
      if (ex.lift !== lift || !ex.main) return;
      ex.sets.forEach((st) => {
        const v = e1rm(st.w, st.r, st.rpe);
        if (v > best) best = v;
      });
    })
  );
  return best;
}

// Auto-regulation: suggest today's weight/reps from the last logged
// performance of this exercise, honouring the athlete's progression rules.
function suggestForExercise(planEx, sessions) {
  const fallback = { w: planEx.w, reps: planEx.reps, note: null };
  if (!planEx.w) return fallback; // bodyweight/timed work doesn't auto-adjust
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const ex = s.exercises.find((e) => e.name === planEx.name && !e.skipped);
    if (!ex) continue;
    const work = ex.sets.filter((st) => st.w > 0 && st.r > 0);
    if (!work.length) continue;

    const lastW = Math.max(...work.map((st) => st.w));
    const rpes = work.map((st) => st.rpe || 0).filter((r) => r > 0);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const maxPain = Math.max(...work.map((st) => st.pain || 0));
    const target = planEx.rpe || 8;
    const inc = planEx.lift === "deadlift" ? 5 : 2.5;
    const isAccessory = !planEx.lift;

    // pain gate beats everything
    if (maxPain >= 4) {
      const w = Math.max(0, Math.round((lastW * 0.9) / 2.5) * 2.5);
      return { w, reps: planEx.reps, note: `↓ to ${w}kg — pain hit ${maxPain}/10 last time. Rebuild from here.` };
    }

    // DOH gate: never progresses unless every rep held
    if (planEx.doh && !work.every((st) => st.doh)) {
      return { w: lastW, reps: planEx.reps, note: `holding ${lastW}kg — grip broke last session. Every rep holds before this moves.` };
    }

    if (avgRpe === null) return { w: lastW, reps: planEx.reps, note: `holding ${lastW}kg — log RPE and this starts auto-adjusting.` };

    if (avgRpe <= target - 0.5) {
      if (isAccessory) {
        const lastR = Math.max(...work.map((st) => st.r));
        if (lastR < planEx.reps + 3)
          return { w: lastW, reps: lastR + 1, note: `↑ +1 rep (RPE ${avgRpe.toFixed(1)} last time — reps before weight).` };
        return { w: lastW + 2.5, reps: planEx.reps, note: `↑ +2.5kg, reps reset — rep range maxed out.` };
      }
      return { w: lastW + inc, reps: planEx.reps, note: `↑ +${inc}kg — averaged RPE ${avgRpe.toFixed(1)} vs target ${target} last session.` };
    }
    if (avgRpe >= target + 1) {
      const w = Math.max(0, lastW - inc);
      return { w, reps: planEx.reps, note: `↓ −${inc}kg — RPE ${avgRpe.toFixed(1)} ran over target ${target}. Own it, then it comes back up.` };
    }
    return { w: lastW, reps: planEx.reps, note: `holding ${lastW}kg — RPE ${avgRpe.toFixed(1)}, right at target.` };
  }
  return fallback;
}

function platesPerSide(total) {
  let side = Math.max(0, (total - 20) / 2);
  const out = [];
  PLATES.forEach((p) => {
    while (side >= p.kg - 0.001) {
      out.push(p);
      side -= p.kg;
    }
  });
  return out;
}

/* ---------- coach engine ---------- */

function buildCoachNotes(data) {
  const notes = [];
  const sessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date));

  // consistency
  if (sessions.length) {
    const last = new Date(sessions[sessions.length - 1].date + "T00:00");
    const gap = Math.floor((Date.now() - last.getTime()) / 86400000);
    if (gap >= 5)
      notes.push({ level: "warn", text: `${gap} days since your last logged session. Don't make sessions up — just resume the schedule today.` });
  } else {
    notes.push({ level: "info", text: "No sessions logged yet. Log your first one from the Train tab and the engine starts working." });
  }

  // per-exercise progression checks (uses YOUR rules)
  const byName = {};
  sessions.forEach((s) =>
    s.exercises.forEach((ex) => {
      if (!ex.sets.length) return;
      (byName[ex.name] = byName[ex.name] || []).push({ date: s.date, ex });
    })
  );

  Object.entries(byName).forEach(([name, hist]) => {
    const lastEx = hist[hist.length - 1].ex;
    const workSets = lastEx.sets.filter((st) => st.w > 0 && st.r > 0);
    if (!workSets.length) return;
    const avgRpe = workSets.reduce((a, s) => a + (s.rpe || 8), 0) / workSets.length;
    const maxPain = Math.max(...workSets.map((s) => s.pain || 0));

    if (name.includes("DOH")) {
      const allDoh = workSets.every((s) => s.doh);
      if (allDoh && avgRpe <= 8)
        notes.push({ level: "go", text: `DOH back-off: every set held at RPE ≤8 → add 2.5kg to the back-offs. Grip is building.` });
      else if (!allDoh)
        notes.push({ level: "info", text: `DOH back-off: grip broke. Hold the weight — the whole point is holding every rep.` });
    } else if (lastEx.lift === "deadlift" && lastEx.main) {
      if (avgRpe <= 7.5 && maxPain <= 2)
        notes.push({ level: "go", text: `Deadlift top sets: averaged RPE ${avgRpe.toFixed(1)} — add 5kg next session (rule met).` });
    } else if ((lastEx.lift === "bench" || lastEx.lift === "squat") && lastEx.main) {
      if (avgRpe <= 7.5 && maxPain <= 2)
        notes.push({ level: "go", text: `${name}: last session averaged RPE ${avgRpe.toFixed(1)} — that's 0.5+ under target. Add 2.5kg (rule met).` });
      if (lastEx.lift === "squat" && maxPain >= 4)
        notes.push({ level: "warn", text: `${name}: knee pain hit ${maxPain}/10 last session. Cut top-set load 10% and double down on wall sits + eccentrics this week.` });
    }
  });

  // pain trend across last 4 sessions
  const painSessions = sessions
    .map((s) => {
      const pains = s.exercises.flatMap((e) => e.sets.map((st) => st.pain || 0));
      return pains.length ? Math.max(...pains) : null;
    })
    .filter((p) => p !== null);
  if (painSessions.length >= 4) {
    const recent = painSessions.slice(-2).reduce((a, b) => a + b, 0) / 2;
    const prior = painSessions.slice(-4, -2).reduce((a, b) => a + b, 0) / 2;
    if (recent >= prior + 1.5)
      notes.push({ level: "warn", text: `Pain trend rising (${prior.toFixed(1)} → ${recent.toFixed(1)}). Reduce lower-body volume ~20% this week and chase that physio booking.` });
  }

  // stagnation detection per main lift
  ["squat", "bench", "deadlift"].forEach((lift) => {
    const pts = sessions
      .map((s) => {
        let best = 0;
        s.exercises.forEach((ex) => {
          if (ex.lift === lift && ex.main)
            ex.sets.forEach((st) => (best = Math.max(best, e1rm(st.w, st.r, st.rpe))));
        });
        return best ? { date: s.date, v: best } : null;
      })
      .filter(Boolean);
    if (pts.length >= 5) {
      const cut = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const recent = pts.filter((p) => p.date >= cut);
      const older = pts.filter((p) => p.date < cut);
      if (recent.length >= 2 && older.length >= 2) {
        const rMax = Math.max(...recent.map((p) => p.v));
        const oMax = Math.max(...older.map((p) => p.v));
        if (rMax <= oMax)
          notes.push({ level: "warn", text: `${lift[0].toUpperCase() + lift.slice(1)} e1RM flat for 4+ weeks (${oMax}kg → ${rMax}kg). Consider a deload week, then rotate the main variation.` });
      }
    }
  });

  // bodyweight trend vs cut target
  const bw = data.bodyweight;
  if (bw.length >= 3) {
    const first = bw[0], last = bw[bw.length - 1];
    const weeks = Math.max(1, (new Date(last.date) - new Date(first.date)) / (7 * 86400000));
    const rate = (last.kg - first.kg) / weeks;
    if (rate > -0.2 && last.kg > 95)
      notes.push({ level: "warn", text: `Bodyweight dropping at ${rate.toFixed(2)}kg/week — target is −0.5. Tighten calories to 2,500 and log everything in MyFitnessPal.` });
    else if (rate < -0.9)
      notes.push({ level: "warn", text: `Losing ${Math.abs(rate).toFixed(2)}kg/week — too fast, you'll bleed strength. Add ~200 kcal.` });
    else if (rate <= -0.2)
      notes.push({ level: "go", text: `Cut on track at ${Math.abs(rate).toFixed(2)}kg/week. Keep protein at 160g+.` });
  }

  if (!notes.some((n) => n.level === "warn"))
    notes.push({ level: "go", text: "No red flags in the data. Show up, log it, follow the progression rules." });

  return notes;
}

/* ---------- storage ---------- */

const EMPTY = { sessions: [], bodyweight: [{ date: todayStr(), kg: 105 }], actions: DEFAULT_ACTIONS, grip: [] };

// Storage adapter: uses Claude's window.storage when available,
// falls back to localStorage when the app is self-hosted (Vite/Next/etc).
const store = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        const res = await window.storage.get(key);
        return res ? res.value : null;
      }
    } catch (e) { /* key missing or Claude storage unavailable */ }
    try {
      return window.localStorage.getItem(key);
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage) {
        await window.storage.set(key, value);
        return;
      }
    } catch (e) { /* fall through */ }
    try { window.localStorage.setItem(key, value); } catch (e) { console.error(e); }
  },
};

async function pushBackup(next) {
  // Keeps the last 5 snapshots under a separate key so a bad write to the
  // primary key is never the only copy of the person's training history.
  try {
    let backups = [];
    const raw = await store.get(BACKUP_KEY);
    if (raw) backups = JSON.parse(raw);
    backups.push({ ts: Date.now(), data: next });
    if (backups.length > 5) backups = backups.slice(backups.length - 5);
    await store.set(BACKUP_KEY, JSON.stringify(backups));
  } catch (e) { /* best-effort — never block the main save on this */ }
}

async function loadData() {
  let primary = null;
  try {
    const raw = await store.get(STORE_KEY);
    if (raw) primary = JSON.parse(raw);
  } catch (e) { /* first run or corrupted primary */ }

  if (primary && Array.isArray(primary.sessions) && primary.sessions.length > 0) {
    return { ...EMPTY, ...primary };
  }

  // Primary is missing or looks empty — before trusting that, check whether
  // a more recent backup actually has real sessions in it. This is what
  // catches an overwrite-with-empty-state bug before the person notices.
  try {
    const rawB = await store.get(BACKUP_KEY);
    if (rawB) {
      const backups = JSON.parse(rawB);
      for (let i = backups.length - 1; i >= 0; i--) {
        const cand = backups[i].data;
        if (cand && Array.isArray(cand.sessions) && cand.sessions.length > 0) {
          return { ...EMPTY, ...cand, _restoredFromBackup: backups[i].ts };
        }
      }
    }
  } catch (e) { /* no usable backup */ }

  return primary ? { ...EMPTY, ...primary } : EMPTY;
}

/* ============================================================ */

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  const [restoredAt, setRestoredAt] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadData().then((d) => {
      if (d._restoredFromBackup) {
        setRestoredAt(d._restoredFromBackup);
        const clean = { ...d };
        delete clean._restoredFromBackup;
        setData(clean);
        // self-heal: rewrite the primary key from the recovered backup immediately
        store.set(STORE_KEY, JSON.stringify(clean)).catch(() => {});
      } else {
        setData(d);
      }
    });
  }, []);

  const save = (next) => {
    setData(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await store.set(STORE_KEY, JSON.stringify(next));
        await pushBackup(next);
      } catch (e) { console.error(e); }
    }, 400);
  };

  if (!data)
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D10", display: "flex", alignItems: "center", justifyContent: "center", color: "#6E6E78", fontFamily: "sans-serif" }}>
        Loading the platform…
      </div>
    );

  return (
    <div className="app">
      <Style />
      <Header />
      {restoredAt && (
        <div className="restoreBanner">
          Recovered your data from an auto-backup taken {new Date(restoredAt).toLocaleString("en-GB")}. Check it looks right, then back it up via Coach → Backup.
        </div>
      )}
      <div className="content">
        {tab === "today" && <Today data={data} save={save} setTab={setTab} />}
        {tab === "train" && <Train data={data} save={save} />}
        {tab === "progress" && <Progress data={data} save={save} />}
        {tab === "coach" && <Coach data={data} save={save} />}
      </div>
      <nav className="nav">
        {[
          ["today", "Today"],
          ["train", "Train"],
          ["progress", "Progress"],
          ["coach", "Coach"],
        ].map(([k, label]) => (
          <button key={k} className={"navBtn" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------- header ---------- */

function Header() {
  const days = Math.max(0, Math.ceil((MEET_DATE - Date.now()) / 86400000));
  return (
    <header className="header">
      <div>
        <div className="brand">BUCS <span className="accent">610</span></div>
        <div className="brandSub">qualifier window closes Mar 2027</div>
      </div>
      <div className="countdown">
        <span className="countNum">{days}</span>
        <span className="countLbl">days out</span>
      </div>
    </header>
  );
}

/* ---------- TODAY ---------- */

function Today({ data, save, setTab }) {
  const dayKey = DAY_KEYS[new Date().getDay()];
  const plan = PROGRAM[dayKey];
  const doneToday = data.sessions.some((s) => s.date === todayStr());

  const est = {
    squat: Math.max(BASELINE.squat, bestE1rmForLift(data.sessions, "squat")),
    bench: Math.max(BASELINE.bench, bestE1rmForLift(data.sessions, "bench")),
    deadlift: Math.max(BASELINE.deadlift, bestE1rmForLift(data.sessions, "deadlift")),
  };
  const total = est.squat + est.bench + est.deadlift;

  const bwLast = data.bodyweight[data.bodyweight.length - 1];
  const [bwInput, setBwInput] = useState("");

  const streak = useMemo(() => {
    const weeks = new Set(
      data.sessions.map((s) => {
        const d = new Date(s.date + "T00:00");
        const onejan = new Date(d.getFullYear(), 0, 1);
        return d.getFullYear() + "-" + Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
      })
    );
    return weeks.size;
  }, [data.sessions]);

  const notes = useMemo(() => buildCoachNotes(data).slice(0, 3), [data]);

  const backupStale = !data.lastBackupAt || (Date.now() - new Date(data.lastBackupAt).getTime()) > 3 * 86400000;

  return (
    <div>
      {backupStale && data.sessions.length > 0 && (
        <div className="card" style={{ borderColor: "#E8B93B" }}>
          <div className="note" style={{ padding: 0 }}>
            <span className="noteDot" style={{ background: "#E8B93B" }} />
            <span>{data.lastBackupAt ? "Backup's a few days old." : "You've never backed up your data."} Coach tab → Backup & restore → Copy — takes 5 seconds.</span>
          </div>
        </div>
      )}
      <div className="card sessionCard">
        <div className="eyebrow">Today · {new Date().toLocaleDateString("en-GB", { weekday: "long" })}</div>
        {plan ? (
          <>
            <div className="sessionTitle">{plan.title}</div>
            <div className="sessionSub">{plan.sub}</div>
            <button className="btnPrimary" onClick={() => setTab("train")}>
              {doneToday ? "Session logged ✓ — view" : "Start session"}
            </button>
          </>
        ) : (
          <div className="sessionTitle">{REST_DAYS[dayKey]}</div>
        )}
      </div>

      <div className="totalBlock card">
        <div className="rowBetween">
          <div className="eyebrow">Estimated total</div>
          <div className="eyebrow">{TARGETS.total}kg needed</div>
        </div>
        <div className="totalNum">
          {Math.round(total)}<span className="totalUnit">kg</span>
          <span className="totalGap">{Math.round(TARGETS.total - total)}kg to go</span>
        </div>
        {["squat", "bench", "deadlift"].map((l) => (
          <LiftBar key={l} lift={l} current={est[l]} target={TARGETS[l]} />
        ))}
        <div className="plateKey">
          {PLATES.slice(0, 5).map((p) => (
            <span key={p.kg} className="keyItem">
              <span className="keyDot" style={{ background: p.color }} /> {p.kg}
            </span>
          ))}
        </div>
      </div>

      <div className="statRow">
        <div className="card stat">
          <div className="statNum">{bwLast.kg}<span className="statUnit">kg</span></div>
          <div className="statLbl">bodyweight → 93</div>
          <div className="bwInputRow">
            <input className="miniInput" type="number" inputMode="decimal" placeholder="log" value={bwInput}
              onChange={(e) => setBwInput(e.target.value)} />
            <button className="miniBtn" onClick={() => {
              const v = parseFloat(bwInput);
              if (!v) return;
              const bw = data.bodyweight.filter((b) => b.date !== todayStr());
              save({ ...data, bodyweight: [...bw, { date: todayStr(), kg: v }].sort((a, b) => a.date.localeCompare(b.date)) });
              setBwInput("");
            }}>✓</button>
          </div>
        </div>
        <div className="card stat">
          <div className="statNum">{data.sessions.length}</div>
          <div className="statLbl">sessions logged</div>
        </div>
        <div className="card stat">
          <div className="statNum">{streak}</div>
          <div className="statLbl">active weeks</div>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Coach notes</div>
        {notes.map((n, i) => <CoachNote key={i} n={n} />)}
      </div>
    </div>
  );
}

function LiftBar({ lift, current, target }) {
  const plates = platesPerSide(current);
  const targetPlates = platesPerSide(target);
  const ghost = targetPlates.slice(plates.length);
  return (
    <div className="liftBar">
      <div className="liftBarHead">
        <span className="liftName">{lift}</span>
        <span className="liftNums">{Math.round(current)} / {target}kg</span>
      </div>
      <div className="barbell">
        <div className="sleeveStart" />
        {plates.map((p, i) => (
          <div key={i} className="plate" style={{ background: p.color, height: p.h }} title={p.kg + "kg"} />
        ))}
        {ghost.map((p, i) => (
          <div key={"g" + i} className="plate ghost" style={{ height: p.h }} />
        ))}
        <div className="bar" />
      </div>
    </div>
  );
}

function CoachNote({ n }) {
  const c = n.level === "warn" ? "#E8B93B" : n.level === "go" ? "#3DA35D" : "#6E6E78";
  return (
    <div className="note">
      <span className="noteDot" style={{ background: c }} />
      <span>{n.text}</span>
    </div>
  );
}

/* ---------- TRAIN ---------- */

function Train({ data, save }) {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const [dayKey, setDayKey] = useState(PROGRAM[todayKey] ? todayKey : "mon");

  return (
    <div>
      <div className="dayTabs">
        {Object.keys(PROGRAM).map((k) => (
          <button key={k} className={"dayTab" + (k === dayKey ? " active" : "")} onClick={() => setDayKey(k)}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="dayHint">Doing this on a different day? Just tap the matching tab — it logs against today's date either way.</div>
      {/* key={dayKey} forces a clean remount when switching days —
          prevents stale session state indexing past a shorter exercise list */}
      <DaySession key={dayKey} dayKey={dayKey} data={data} save={save} />
    </div>
  );
}

function DaySession({ dayKey, data, save }) {
  const plan = PROGRAM[dayKey];

  const existing = data.sessions.find((s) => s.date === todayStr() && s.dayKey === dayKey);

  const blank = () => ({
    id: Date.now(), date: todayStr(), dayKey,
    exercises: plan.exercises.map((ex) => {
      const sug = suggestForExercise(ex, data.sessions);
      return {
        name: ex.name, lift: ex.lift || null, main: !!ex.main, targetW: sug.w, dohFlag: !!ex.doh, skipped: false,
        autoNote: sug.note,
        sets: Array.from({ length: ex.sets }, () => ({ w: sug.w, r: sug.reps, rpe: "", pain: 0, doh: !!ex.doh })),
        notes: "",
      };
    }),
  });

  const [session, setSession] = useState(existing || blank());

  const update = (exI, setI, field, val) => {
    const next = JSON.parse(JSON.stringify(session));
    next.exercises[exI].sets[setI][field] = val;
    setSession(next);
  };
  const updateNotes = (exI, val) => {
    const next = { ...session, exercises: session.exercises.map((e, i) => (i === exI ? { ...e, notes: val } : e)) };
    setSession(next);
  };
  const updateName = (exI, val) => {
    const next = { ...session, exercises: session.exercises.map((e, i) => (i === exI ? { ...e, name: val } : e)) };
    setSession(next);
  };
  const toggleSkip = (exI) => {
    const next = { ...session, exercises: session.exercises.map((e, i) => (i === exI ? { ...e, skipped: !e.skipped } : e)) };
    setSession(next);
  };
  const addExercise = () => {
    const next = {
      ...session,
      exercises: [...session.exercises, {
        name: "New exercise", lift: null, main: false, targetW: 0, dohFlag: false, skipped: false,
        sets: Array.from({ length: 3 }, () => ({ w: 0, r: 0, rpe: "", pain: 0, doh: false })),
        notes: "",
      }],
    };
    setSession(next);
  };
  const removeExercise = (exI) => {
    const next = { ...session, exercises: session.exercises.filter((_, i) => i !== exI) };
    setSession(next);
  };

  const finish = () => {
    const cleaned = {
      ...session,
      exercises: session.exercises.map((ex) => ({
        ...ex,
        sets: ex.skipped
          ? ex.sets.map((s) => ({ ...s, w: 0, r: 0, rpe: 0, pain: 0 }))
          : ex.sets.map((s) => ({ ...s, w: parseFloat(s.w) || 0, r: parseInt(s.r) || 0, rpe: parseFloat(s.rpe) || 0, pain: parseInt(s.pain) || 0 })),
      })),
    };
    const others = data.sessions.filter((s) => !(s.date === cleaned.date && s.dayKey === cleaned.dayKey));
    save({ ...data, sessions: [...others, cleaned] });
  };

  const analysis = existing ? analyseSession(existing, data) : null;

  const pastSessions = data.sessions
    .filter((s) => s.dayKey === dayKey && s.date !== todayStr())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div>
      <div className="card sessionCard" style={{ marginBottom: 12 }}>
        <div className="sessionTitle" style={{ fontSize: 22 }}>{plan.title}</div>
        <div className="sessionSub">{plan.sub}</div>
        <RestTimer />
      </div>

      {session.exercises.map((ex, exI) => {
        const planEx = plan.exercises[exI] || { sets: ex.sets.length, reps: "-", cue: "" };
        return (
        <div className={"card exCard" + (ex.skipped ? " isSkipped" : "")} key={exI}>
          <div className="rowBetween">
            <input className="exNameInput" value={ex.name} onChange={(e) => updateName(exI, e.target.value)} />
            <div className="exBtnGroup">
              <button className="miniBtn" onClick={() => toggleSkip(exI)}>{ex.skipped ? "unskip" : "skip"}</button>
              <button className="miniBtn" onClick={() => removeExercise(exI)}>✕</button>
            </div>
          </div>
          <div className="rowBetween">
            {ex.main && <span className="mainTag">tracks {ex.lift}</span>}
            <div className="exBtnGroup">
              <a className="miniBtn" style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer"
                href={"https://www.youtube.com/results?search_query=" + encodeURIComponent(ex.name + " exercise form")}>
                ▶ demo
              </a>
              <div className="exTarget" style={{ alignSelf: "center" }}>{planEx.sets}×{planEx.reps} @ {ex.targetW || "—"}kg · RPE {planEx.rpe || 8}</div>
            </div>
          </div>
          {!ex.skipped && ex.autoNote && <div className="autoNote">auto: {ex.autoNote}</div>}
          {!ex.skipped && planEx.cue && <div className="cue">{planEx.cue}</div>}

          {ex.skipped ? (
            <div className="empty" style={{ padding: "8px 0" }}>Skipped this session — not counted in analysis.</div>
          ) : (
            <>
              <div className="setHead">
                <span>set</span><span>kg</span><span>reps</span><span>rpe</span><span>pain</span>{ex.dohFlag && <span>doh</span>}
              </div>
              {ex.sets.map((st, setI) => (
                <div className={"setRow" + (ex.dohFlag ? " withDoh" : "")} key={setI}>
                  <span className="setNum">{setI + 1}</span>
                  <input className="setInput" type="number" inputMode="decimal" value={st.w}
                    onChange={(e) => update(exI, setI, "w", e.target.value)} />
                  <select className="setInput" value={st.r} onChange={(e) => update(exI, setI, "r", e.target.value)}>
                    {Array.from({ length: 31 }, (_, i) => i).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select className="setInput" value={st.rpe} onChange={(e) => update(exI, setI, "rpe", e.target.value)}>
                    <option value="">—</option>
                    {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select className="setInput" value={st.pain} onChange={(e) => update(exI, setI, "pain", e.target.value)}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {ex.dohFlag && (
                    <button className={"dohBtn" + (st.doh ? " on" : "")} onClick={() => update(exI, setI, "doh", !st.doh)}>
                      {st.doh ? "✓" : "✗"}
                    </button>
                  )}
                </div>
              ))}
              <input className="notesInput" placeholder="notes — grip seconds, how it moved, left side…" value={ex.notes}
                onChange={(e) => updateNotes(exI, e.target.value)} />
            </>
          )}
        </div>
        );
      })}

      <button className="miniBtn" style={{ width: "100%", padding: "10px 0", marginBottom: 12 }} onClick={addExercise}>
        + Add exercise
      </button>

      <button className="btnPrimary big" onClick={finish}>
        {existing ? "Update session" : "Finish & analyse session"}
      </button>

      {analysis && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Session debrief</div>
          {analysis.greens.length > 0 && (
            <>
              <div className="flagHead" style={{ color: "#3DA35D" }}>Green flags</div>
              {analysis.greens.map((t, i) => (
                <div className="note" key={"g" + i}><span className="noteDot" style={{ background: "#3DA35D" }} /><span>{t}</span></div>
              ))}
            </>
          )}
          {analysis.reds.length > 0 && (
            <>
              <div className="flagHead" style={{ color: "#E23D3D" }}>Red flags</div>
              {analysis.reds.map((t, i) => (
                <div className="note" key={"r" + i}><span className="noteDot" style={{ background: "#E23D3D" }} /><span>{t}</span></div>
              ))}
            </>
          )}
          {analysis.infos.length > 0 && (
            <>
              <div className="flagHead" style={{ color: "#6E6E78" }}>Notes</div>
              {analysis.infos.map((t, i) => (
                <div className="note" key={"i" + i}><span className="noteDot" style={{ background: "#6E6E78" }} /><span>{t}</span></div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="rowBetween">
          <div className="eyebrow">Past {plan.title} sessions</div>
          <button className="miniBtn" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "hide" : `show (${pastSessions.length})`}
          </button>
        </div>
        {showHistory && (
          pastSessions.length ? pastSessions.map((s) => (
            <div className="histSession" key={s.id}>
              <div className="histDate">{fmtShort(s.date)}</div>
              {s.exercises.filter((ex) => !ex.skipped && ex.notes).length
                ? s.exercises.filter((ex) => !ex.skipped && ex.notes).map((ex, i) => (
                  <div className="note" key={i}><span className="noteDot" style={{ background: "#2E6FE0" }} /><span><b>{ex.name}:</b> {ex.notes}</span></div>
                ))
                : <div className="empty" style={{ padding: "6px 0" }}>No notes logged that day.</div>}
            </div>
          )) : <div className="empty">No past sessions of this type yet.</div>
        )}
      </div>
    </div>
  );
}

function analyseSession(session, data) {
  const greens = [], reds = [], infos = [];
  const active = session.exercises.filter((ex) => !ex.skipped);

  // tonnage + comparison vs last same-type session
  let tonnage = 0;
  active.forEach((ex) => ex.sets.forEach((s) => (tonnage += (s.w || 0) * (s.r || 0))));
  const prevSame = data.sessions
    .filter((s) => s.dayKey === session.dayKey && s.id !== session.id)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prevSame) {
    let prevT = 0;
    prevSame.exercises.filter((e) => !e.skipped).forEach((ex) => ex.sets.forEach((s) => (prevT += (s.w || 0) * (s.r || 0))));
    if (prevT > 0) {
      const pct = Math.round(((tonnage - prevT) / prevT) * 100);
      infos.push(`Tonnage: ${Math.round(tonnage).toLocaleString()}kg (${pct >= 0 ? "+" : ""}${pct}% vs last ${session.dayKey.toUpperCase()} session).`);
    } else infos.push(`Tonnage: ${Math.round(tonnage).toLocaleString()}kg.`);
  } else {
    infos.push(`Tonnage: ${Math.round(tonnage).toLocaleString()}kg — first logged session of this type, this is your baseline.`);
  }

  // completion
  const skippedCount = session.exercises.length - active.length;
  if (skippedCount === 0) greens.push("Full session completed — every exercise done.");
  else infos.push(`${skippedCount} exercise${skippedCount > 1 ? "s" : ""} skipped this session.`);

  // per-exercise checks
  let sessionMaxPain = 0;
  active.forEach((ex) => {
    const workSets = ex.sets.filter((s) => s.w > 0 && s.r > 0);
    if (!workSets.length) return;
    const rpes = workSets.map((s) => s.rpe || 0).filter((r) => r > 0);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const maxPain = Math.max(...workSets.map((s) => s.pain || 0));
    sessionMaxPain = Math.max(sessionMaxPain, maxPain);

    // e1RM check for main lifts
    if (ex.main && ex.lift) {
      let best = 0;
      workSets.forEach((s) => (best = Math.max(best, e1rm(s.w, s.r, s.rpe))));
      if (best) {
        const prevBest = bestE1rmForLift(data.sessions.filter((s) => s.id !== session.id), ex.lift) || BASELINE[ex.lift];
        if (best > prevBest) greens.push(`${ex.name}: new best e1RM ${best}kg (was ${prevBest}kg) — PR signal.`);
        else infos.push(`${ex.name}: e1RM ${best}kg today (best: ${prevBest}kg).`);
      }
    }

    // RPE reading
    if (avgRpe !== null) {
      if (avgRpe <= 7.5 && ex.main) greens.push(`${ex.name}: averaged RPE ${avgRpe.toFixed(1)} — under target. Progression rule is close to being met.`);
      if (avgRpe >= 9.3) reds.push(`${ex.name}: averaged RPE ${avgRpe.toFixed(1)} — too close to failure. Main lifts should never live there; pull the weight back next time.`);
    }

    // pain
    if (maxPain >= 4) reds.push(`${ex.name}: pain hit ${maxPain}/10 — flag for physio, drop load 10% next session if it repeats.`);
    else if (maxPain === 3) infos.push(`${ex.name}: pain touched 3/10 — watch it, that's your working ceiling.`);

    // DOH
    if (ex.dohFlag) {
      const allDoh = workSets.every((s) => s.doh);
      if (allDoh) greens.push(`${ex.name}: every set held double overhand — grip is building.`);
      else reds.push(`${ex.name}: grip broke on at least one set — hold the weight until every rep holds.`);
    }
  });

  if (sessionMaxPain === 0 && active.length > 0) greens.push("Zero pain across the entire session.");

  return { greens, reds, infos };
}

function RestTimer() {
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    if (secs === 1) setRunning(false);
    return () => clearTimeout(t);
  }, [running, secs]);
  const mm = String(Math.floor(secs / 60));
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <div className="timerRow">
      <span className={"timerDisp" + (running && secs <= 10 ? " hot" : "")}>{mm}:{ss}</span>
      {[120, 180, 300].map((t) => (
        <button key={t} className="miniBtn" onClick={() => { setSecs(t); setRunning(true); }}>{t / 60}m</button>
      ))}
      <button className="miniBtn" onClick={() => { setSecs(0); setRunning(false); }}>reset</button>
    </div>
  );
}

/* ---------- PROGRESS ---------- */

function Progress({ data }) {
  const sessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const [view, setView] = useState("squat");

  const liftPoints = (lift) =>
    sessions
      .map((s) => {
        let best = 0;
        s.exercises.forEach((ex) => {
          if (ex.lift === lift && ex.main && !ex.skipped) ex.sets.forEach((st) => (best = Math.max(best, e1rm(st.w, st.r, st.rpe))));
        });
        return best ? { date: s.date, label: fmtShort(s.date), v: best } : null;
      })
      .filter(Boolean);

  const tonnageByWeek = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      const d = new Date(s.date + "T00:00");
      const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = monday.toISOString().slice(0, 10);
      let t = 0;
      s.exercises.filter((e) => !e.skipped).forEach((ex) => ex.sets.forEach((st) => (t += (st.w || 0) * (st.r || 0))));
      map[k] = (map[k] || 0) + t;
    });
    return Object.entries(map).sort().map(([k, v]) => ({ label: fmtShort(k), v: Math.round(v) }));
  }, [sessions]);

  const rpeSeries = sessions
    .map((s) => {
      const rpes = s.exercises.filter((e) => !e.skipped).flatMap((ex) => ex.sets.map((st) => st.rpe || 0)).filter((r) => r > 0);
      return rpes.length ? { label: fmtShort(s.date), v: Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 } : null;
    })
    .filter(Boolean);

  const painSeries = sessions
    .map((s) => {
      const pains = s.exercises.filter((e) => !e.skipped).flatMap((ex) => ex.sets.map((st) => st.pain || 0));
      return pains.length ? { label: fmtShort(s.date), v: Math.max(...pains) } : null;
    })
    .filter(Boolean);

  const bwSeries = data.bodyweight.map((b) => ({ label: fmtShort(b.date), v: b.kg }));

  // simple linear projection: days until e1RM trend line crosses target
  const projection = (lift) => {
    const pts = liftPoints(lift);
    if (pts.length < 3) return null;
    const xs = pts.map((p) => new Date(p.date + "T00:00").getTime() / 86400000);
    const ys = pts.map((p) => p.v);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (den === 0) return null;
    const slope = num / den; // kg per day
    if (slope <= 0.005) return { flat: true };
    const current = Math.max(...ys);
    const daysToTarget = (TARGETS[lift] - current) / slope;
    const when = new Date(Date.now() + daysToTarget * 86400000);
    return { flat: false, date: when, perWeek: slope * 7 };
  };

  const CHARTS = {
    squat: { title: "Squat e1RM", data: liftPoints("squat").map((p) => ({ label: p.label, v: p.v })), color: "#E23D3D", ref: TARGETS.squat, type: "line" },
    bench: { title: "Bench e1RM", data: liftPoints("bench").map((p) => ({ label: p.label, v: p.v })), color: "#2E6FE0", ref: TARGETS.bench, type: "line" },
    deadlift: { title: "Deadlift e1RM", data: liftPoints("deadlift").map((p) => ({ label: p.label, v: p.v })), color: "#E8B93B", ref: TARGETS.deadlift, type: "line" },
    tonnage: { title: "Weekly tonnage (kg)", data: tonnageByWeek, color: "#3DA35D", type: "bar" },
    rpe: { title: "Average session RPE", data: rpeSeries, color: "#B57EDC", ref: 8, refLabel: "target ceiling", type: "line", domain: [5, 10] },
    pain: { title: "Max pain per session", data: painSeries, color: "#E86A3D", ref: 3, type: "line", domain: [0, 8] },
    bodyweight: { title: "Bodyweight (kg)", data: bwSeries, color: "#EDECE8", ref: 93, type: "line", domain: [85, "auto"] },
  };
  const chart = CHARTS[view];

  // best current per lift for target bars
  const bests = {
    squat: Math.max(BASELINE.squat, bestE1rmForLift(sessions, "squat")),
    bench: Math.max(BASELINE.bench, bestE1rmForLift(sessions, "bench")),
    deadlift: Math.max(BASELINE.deadlift, bestE1rmForLift(sessions, "deadlift")),
  };

  return (
    <div>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Progress to BUCS targets</div>
        {["squat", "bench", "deadlift"].map((lift) => {
          const pct = Math.min(100, Math.round((bests[lift] / TARGETS[lift]) * 100));
          const proj = projection(lift);
          return (
            <div key={lift} style={{ marginBottom: 12 }}>
              <div className="rowBetween" style={{ marginBottom: 4 }}>
                <span className="liftName">{lift}</span>
                <span className="liftNums">{Math.round(bests[lift])} / {TARGETS[lift]}kg · {pct}%</span>
              </div>
              <div className="progTrack"><div className="progFill" style={{ width: pct + "%", background: CHARTS[lift].color }} /></div>
              <div className="projText">
                {proj === null && "Log 3+ sessions of this lift for a trend projection."}
                {proj && proj.flat && "Trend is flat — no projection until it moves."}
                {proj && !proj.flat && `Trending +${proj.perWeek.toFixed(1)}kg/week → target ~${proj.date.toLocaleDateString("en-GB", { month: "short", year: "numeric" })} at this rate.`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="chartTabs">
        {Object.entries({ squat: "SQ", bench: "BP", deadlift: "DL", tonnage: "VOL", rpe: "RPE", pain: "PAIN", bodyweight: "BW" }).map(([k, label]) => (
          <button key={k} className={"chartTab" + (view === k ? " active" : "")} onClick={() => setView(k)}>{label}</button>
        ))}
      </div>

      <div className="card">
        <div className="rowBetween">
          <div className="eyebrow">{chart.title}</div>
          {chart.ref && <div className="eyebrow">{chart.refLabel || "target"} {chart.ref}</div>}
        </div>
        {chart.data.length ? (
          <ResponsiveContainer width="100%" height={200}>
            {chart.type === "bar" ? (
              <BarChart data={chart.data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#26262C" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#6E6E78", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6E6E78", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1A1A1F", border: "1px solid #26262C", borderRadius: 8, color: "#EDECE8" }} />
                <Bar dataKey="v" fill={chart.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chart.data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#26262C" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "#6E6E78", fontSize: 10 }} />
                <YAxis tick={{ fill: "#6E6E78", fontSize: 10 }} domain={chart.domain || ["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "#1A1A1F", border: "1px solid #26262C", borderRadius: 8, color: "#EDECE8" }} />
                {chart.ref && <ReferenceLine y={chart.ref} stroke={chart.color} strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="v" stroke={chart.color} strokeWidth={2} dot={{ r: 3, fill: chart.color }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="empty">No data for this chart yet — it fills in as you log.</div>
        )}
      </div>
    </div>
  );
}

/* ---------- COACH ---------- */

function Coach({ data, save }) {
  const notes = useMemo(() => buildCoachNotes(data), [data]);
  const [showData, setShowData] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const toggle = (id) => {
    save({ ...data, actions: data.actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) });
  };
  const doImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.sessions || !Array.isArray(parsed.sessions)) throw new Error("bad shape");
      save({ ...EMPTY, ...parsed });
      setImportMsg("Imported — " + parsed.sessions.length + " sessions restored.");
      setImportText("");
    } catch (e) {
      setImportMsg("That doesn't look like a valid export. Paste the full JSON.");
    }
  };
  return (
    <div>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Full coach report</div>
        {notes.map((n, i) => <CoachNote key={i} n={n} />)}
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Weak-point watchlist</div>
        {[
          "Left side is the limiter on all three lifts — film every top set from the left",
          "Bench: off the chest + left arm lag → paused and pin work stay priority #1",
          "Deadlift: pull heavy mixed/hook — grip now trains in parallel, never as a cap",
          "Squat: left knee governs load. Pain >3 = stop the exercise, not the session. 2x/week frequency IS the rehab",
          "Ankle dorsiflexion (left) feeding the knee — calf stretch before every lower day",
        ].map((t, i) => (
          <div className="note" key={i}><span className="noteDot" style={{ background: "#E23D3D" }} /><span>{t}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Action items</div>
        {data.actions.map((a) => (
          <button key={a.id} className={"action" + (a.done ? " done" : "")} onClick={() => toggle(a.id)}>
            <span className="actionBox">{a.done ? "✓" : ""}</span>
            <span>{a.text}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Progression rules (locked in)</div>
        {[
          "Bench +2.5kg — only when every set finishes 0.5–1 RPE under target",
          "Squat +2.5kg — only when stability is fully resolved (Friday squat stays RPE 6-7)",
          "Deadlift top sets +5kg — when all sets average RPE ≤7.5 (mixed/hook grip)",
          "DOH back-offs +2.5kg — only when every rep of every set holds",
          "Accessories — add reps before weight",
          "Never train main lifts to failure. Never make up missed sessions.",
        ].map((t, i) => (
          <div className="note" key={i}><span className="noteDot" style={{ background: "#2E6FE0" }} /><span>{t}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="rowBetween">
          <div className="eyebrow">Your data — backup & restore</div>
          <button className="miniBtn" onClick={() => setShowData(!showData)}>{showData ? "hide" : "open"}</button>
        </div>
        {showData && (
          <div style={{ marginTop: 10 }}>
            <div className="note" style={{ paddingTop: 0 }}>
              <span>Copy this JSON somewhere safe (notes app, cloud drive). Paste it back into any copy of this app to restore everything.</span>
            </div>
            <textarea
              className="dataBox"
              readOnly
              value={JSON.stringify(data)}
              onFocus={(e) => e.target.select()}
            />
            <button className="btnPrimary" style={{ marginTop: 8 }} onClick={async () => {
              const json = JSON.stringify(data);
              try {
                await navigator.clipboard.writeText(json);
                save({ ...data, lastBackupAt: new Date().toISOString() });
                setImportMsg("Copied — paste it into your notes app or a doc now, somewhere outside this app.");
              } catch (e) {
                setImportMsg("Couldn't auto-copy in this browser — tap the box above, select all, and copy manually.");
              }
            }}>Copy backup to clipboard</button>
            <div className="eyebrow" style={{ margin: "12px 0 6px" }}>Restore from backup</div>
            <textarea
              className="dataBox"
              placeholder="Paste exported JSON here…"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <button className="btnPrimary" style={{ marginTop: 8 }} onClick={doImport}>Import data</button>
            {importMsg && <div className="note"><span>{importMsg}</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,500;100,700;125,900&family=JetBrains+Mono:wght@400;700&display=swap');

      * { box-sizing: border-box; margin: 0; }
      .app {
        min-height: 100vh; background: #0D0D10; color: #EDECE8;
        font-family: 'Archivo', system-ui, sans-serif;
        max-width: 560px; margin: 0 auto; padding-bottom: 74px;
      }
      .content { padding: 12px 14px; }
      .restoreBanner {
        background: #2A2410; border: 1px solid #E8B93B; color: #E8B93B; font-size: 12px;
        padding: 10px 14px; margin: 0 14px 4px; border-radius: 10px; line-height: 1.4;
      }
      .header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 18px 16px 10px;
        border-bottom: 1px solid #1E1E24;
      }
      .brand { font-weight: 900; font-size: 26px; letter-spacing: 0.5px; font-stretch: 125%; }
      .accent { color: #E23D3D; }
      .brandSub { color: #6E6E78; font-size: 11px; margin-top: 2px; }
      .countdown { text-align: right; }
      .countNum { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 24px; display: block; }
      .countLbl { color: #6E6E78; font-size: 11px; }

      .card { background: #16161B; border: 1px solid #22222A; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
      .eyebrow { color: #6E6E78; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
      .rowBetween { display: flex; justify-content: space-between; align-items: baseline; }

      .sessionCard { background: linear-gradient(150deg, #1B1B22, #131318); }
      .sessionTitle { font-size: 26px; font-weight: 900; font-stretch: 125%; margin-top: 6px; }
      .sessionSub { color: #9A9AA4; font-size: 13px; margin: 4px 0 12px; }
      .btnPrimary {
        background: #E23D3D; color: #fff; border: none; border-radius: 10px;
        padding: 12px 18px; font-weight: 700; font-size: 15px; font-family: inherit; cursor: pointer; width: 100%;
      }
      .btnPrimary.big { padding: 15px; font-size: 16px; }
      .btnPrimary:active { transform: scale(0.98); }

      .totalNum { font-family: 'JetBrains Mono', monospace; font-size: 40px; font-weight: 700; margin: 6px 0 12px; }
      .totalUnit { font-size: 18px; color: #6E6E78; margin-left: 2px; }
      .totalGap { font-size: 12px; color: #E8B93B; margin-left: 12px; font-family: 'Archivo'; }

      .liftBar { margin-bottom: 14px; }
      .liftBarHead { display: flex; justify-content: space-between; margin-bottom: 5px; }
      .liftName { text-transform: uppercase; font-size: 12px; letter-spacing: 1px; font-weight: 700; color: #9A9AA4; }
      .liftNums { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #EDECE8; }
      .barbell { display: flex; align-items: center; height: 50px; position: relative; }
      .bar { flex: 1; height: 5px; background: linear-gradient(#4A4A54, #2E2E36); border-radius: 3px; }
      .sleeveStart { width: 10px; height: 12px; background: #3A3A44; border-radius: 2px; margin-right: 1px; }
      .plate { width: 9px; border-radius: 2px; margin-right: 2px; box-shadow: inset -2px 0 3px rgba(0,0,0,0.4); }
      .plate.ghost { background: transparent; border: 1px dashed #33333C; box-shadow: none; }
      .plateKey { display: flex; gap: 12px; margin-top: 2px; }
      .keyItem { font-size: 10px; color: #6E6E78; display: flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; }
      .keyDot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }

      .statRow { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
      .stat { text-align: center; padding: 12px 6px; margin-bottom: 0; }
      .statNum { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; }
      .statUnit { font-size: 12px; color: #6E6E78; }
      .statLbl { font-size: 10px; color: #6E6E78; margin-top: 3px; }
      .bwInputRow { display: flex; gap: 4px; margin-top: 8px; justify-content: center; }
      .miniInput {
        width: 54px; background: #0D0D10; border: 1px solid #2A2A32; color: #EDECE8;
        border-radius: 8px; padding: 5px 6px; font-family: 'JetBrains Mono', monospace; font-size: 12px;
      }
      .miniBtn {
        background: #22222A; color: #EDECE8; border: 1px solid #2E2E38; border-radius: 8px;
        padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
      }

      .note { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.45; padding: 6px 0; color: #D8D7D2; }
      .noteDot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }

      .dayTabs { display: flex; gap: 6px; margin-bottom: 12px; }
      .dayTab {
        flex: 1; background: #16161B; border: 1px solid #22222A; color: #6E6E78;
        border-radius: 10px; padding: 9px 0; font-weight: 700; font-size: 12px; cursor: pointer; font-family: inherit;
      }
      .dayTab.active { background: #E23D3D; border-color: #E23D3D; color: #fff; }
      .dayHint { font-size: 11px; color: #55555E; margin: -6px 0 12px; padding: 0 2px; }

      .exCard.isSkipped { opacity: 0.55; }
      .exNameInput {
        background: none; border: none; color: #EDECE8; font-weight: 700; font-size: 15px;
        font-family: inherit; padding: 4px 0; flex: 1; border-bottom: 1px dashed transparent;
      }
      .exNameInput:focus { outline: none; border-bottom: 1px dashed #3A3A44; }
      .exBtnGroup { display: flex; gap: 6px; }
      .histSession { padding: 8px 0; border-top: 1px solid #1E1E24; }
      .histDate { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #6E6E78; margin-bottom: 4px; }

      .flagHead { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin: 10px 0 2px; }
      .progTrack { height: 8px; background: #0D0D10; border: 1px solid #22222A; border-radius: 5px; overflow: hidden; }
      .progFill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
      .projText { font-size: 11px; color: #6E6E78; margin-top: 4px; }
      .chartTabs { display: flex; gap: 5px; margin-bottom: 12px; flex-wrap: wrap; }
      .chartTab {
        flex: 1; min-width: 44px; background: #16161B; border: 1px solid #22222A; color: #6E6E78;
        border-radius: 9px; padding: 8px 0; font-weight: 700; font-size: 11px; cursor: pointer; font-family: inherit;
      }
      .chartTab.active { background: #EDECE8; border-color: #EDECE8; color: #0D0D10; }

      .exCard { padding: 12px; }
      .exName { font-weight: 700; font-size: 15px; }
      .mainTag {
        background: #2E6FE0; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 5px;
        margin-left: 8px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .exTarget { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #6E6E78; }
      .cue { font-size: 12px; color: #E8B93B; margin: 5px 0 3px; }
      .autoNote { font-size: 12px; color: #3DA35D; margin: 5px 0 0; font-family: 'JetBrains Mono', monospace; }
      .setHead, .setRow { display: grid; grid-template-columns: 28px 1fr 1fr 1fr 1fr; gap: 6px; align-items: center; margin-top: 6px; }
      .setHead { color: #55555E; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
      .setRow.withDoh, .setHead:has(+ .setRow.withDoh) { grid-template-columns: 28px 1fr 1fr 1fr 1fr 40px; }
      .exCard:has(.withDoh) .setHead { grid-template-columns: 28px 1fr 1fr 1fr 1fr 40px; }
      .setNum { color: #55555E; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-align: center; }
      .setInput {
        background: #0D0D10; border: 1px solid #26262E; color: #EDECE8; border-radius: 8px;
        padding: 8px 6px; font-family: 'JetBrains Mono', monospace; font-size: 13px; width: 100%; text-align: center;
      }
      .setInput:focus { outline: 2px solid #2E6FE0; border-color: transparent; }
      .dohBtn {
        background: #0D0D10; border: 1px solid #26262E; color: #E23D3D; border-radius: 8px;
        padding: 8px 0; cursor: pointer; font-size: 13px; font-weight: 700;
      }
      .dohBtn.on { color: #3DA35D; border-color: #3DA35D; }
      .notesInput {
        width: 100%; background: #0D0D10; border: 1px solid #26262E; color: #EDECE8;
        border-radius: 8px; padding: 8px 10px; font-size: 12px; margin-top: 10px; font-family: inherit;
      }

      .timerRow { display: flex; gap: 6px; align-items: center; }
      .timerDisp { font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 700; margin-right: 8px; min-width: 70px; }
      .timerDisp.hot { color: #E23D3D; }

      .empty { color: #55555E; font-size: 13px; padding: 20px 0; text-align: center; }

      .dataBox {
        width: 100%; height: 90px; background: #0D0D10; border: 1px solid #26262E;
        color: #9A9AA4; border-radius: 8px; padding: 8px; font-family: 'JetBrains Mono', monospace;
        font-size: 10px; resize: vertical;
      }

      .action {
        display: flex; gap: 10px; align-items: flex-start; width: 100%; text-align: left;
        background: none; border: none; color: #D8D7D2; font-size: 13.5px; padding: 7px 0;
        cursor: pointer; font-family: inherit; line-height: 1.4;
      }
      .action.done { color: #55555E; text-decoration: line-through; }
      .actionBox {
        width: 18px; height: 18px; border: 1.5px solid #3A3A44; border-radius: 5px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center; font-size: 11px; color: #3DA35D; margin-top: 1px;
      }
      .action.done .actionBox { border-color: #3DA35D; }

      .nav {
        position: fixed; bottom: 0; left: 0; right: 0; max-width: 560px; margin: 0 auto;
        display: flex; background: #111115; border-top: 1px solid #1E1E24; padding: 6px 8px 10px;
      }
      .navBtn {
        flex: 1; background: none; border: none; color: #55555E; font-weight: 700;
        font-size: 12px; padding: 10px 0; cursor: pointer; font-family: inherit; border-radius: 10px;
        text-transform: uppercase; letter-spacing: 0.8px;
      }
      .navBtn.active { color: #EDECE8; background: #1C1C22; }

      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `}</style>
  );
}
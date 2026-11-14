import { create } from 'zustand';
import {
  defaultDesign,
  startFlight,
  resolveCrisis,
} from './eng';
import type {
  Design,
  FlightRun,
  FlightResult,
  LessonState,
  ProcessId,
  SlotId,
  FailureAnim,
} from './eng';
import { isoDay, dayDiff } from './format';

/* ---------- safe storage ---------- */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the game still runs, it just forgets */
  }
}

/* ---------- types ---------- */
export interface Mission {
  briefId: string;
  seed: number;
  daily: boolean;
  design: Design;
  flagged: string[];
  fixed: string[];
  run: FlightRun | null;
  recorded: boolean;
  refly: { slots: SlotId[]; lessons: string[] } | null;
  attempt: number;
}

export interface RunRecord {
  at: string;
  day: string;
  briefId: string;
  seed: number;
  daily: boolean;
  refly: boolean;
  outcome: FlightResult['outcome'];
  sciencePct: number;
  triggered: string[];
  caught: string[];
  prevented: string[];
  missed: string[];
  falseFlags: string[];
}

export interface Streak {
  count: number;
  last: string | null;
}

interface State {
  mission: Mission | null;
  lessons: Record<string, LessonState>;
  runs: RunRecord[];
  streak: Streak;
  startMission: (briefId: string, seed: number, daily: boolean) => void;
  setPart: (slot: SlotId, id: string) => void;
  toggleInstrument: (id: string, max: number) => void;
  setProcess: (p: ProcessId, id: string) => void;
  toggleFlag: (id: string) => void;
  setFix: (id: string, on: boolean) => void;
  launch: () => FlightRun | null;
  resolve: (optionId: string) => void;
  record: () => void;
  refly: () => void;
}

export const ANIM_SLOT: Partial<Record<FailureAnim, SlotId>> = {
  antenna_jam: 'antenna',
  signal_lost: 'antenna',
  panel_stuck: 'power',
  wheel_fail: 'attitude',
  tumble: 'attitude',
  battery_drain: 'battery',
  engine_cutoff: 'propulsion',
  valve_stick: 'propulsion',
  overheat: 'thermal',
  crash: 'computer',
};

const K = { mission: 'flown.mission', lessons: 'flown.lessons', runs: 'flown.runs', streak: 'flown.streak' };

export const useGame = create<State>((set, get) => ({
  mission: load<Mission | null>(K.mission, null),
  lessons: load<Record<string, LessonState>>(K.lessons, {}),
  runs: load<RunRecord[]>(K.runs, []),
  streak: load<Streak>(K.streak, { count: 0, last: null }),

  startMission(briefId, seed, daily) {
    const mission: Mission = {
      briefId,
      seed,
      daily,
      design: defaultDesign(briefId),
      flagged: [],
      fixed: [],
      run: null,
      recorded: false,
      refly: null,
      attempt: 1,
    };
    set({ mission });
    save(K.mission, persistable(mission));
  },

  setPart(slot, id) {
    patchMission({ design: { ...need().design, parts: { ...need().design.parts, [slot]: id } } });
  },

  toggleInstrument(id, max) {
    const d = need().design;
    const has = d.instruments.includes(id);
    if (!has && d.instruments.length >= max) return;
    const instruments = has ? d.instruments.filter((x) => x !== id) : [...d.instruments, id];
    patchMission({ design: { ...d, instruments } });
  },

  setProcess(p, id) {
    const d = need().design;
    patchMission({ design: { ...d, process: { ...d.process, [p]: id } } });
  },

  toggleFlag(id) {
    const m = need();
    const on = m.flagged.includes(id);
    patchMission({
      flagged: on ? m.flagged.filter((x) => x !== id) : [...m.flagged, id],
      fixed: on ? m.fixed.filter((x) => x !== id) : m.fixed,
    });
  },

  setFix(id, on) {
    const m = need();
    const fixed = on ? Array.from(new Set([...m.fixed, id])) : m.fixed.filter((x) => x !== id);
    patchMission({ fixed });
  },

  launch() {
    const m = get().mission;
    if (!m) return null;
    const run = startFlight(m.design, m.seed, m.flagged, m.fixed);
    patchMission({ run, recorded: false });
    return run;
  },

  resolve(optionId) {
    const m = need();
    if (!m.run) return;
    patchMission({ run: resolveCrisis(m.run, optionId) });
  },

  record() {
    const s = get();
    const m = s.mission;
    if (!m || !m.run?.done || !m.run.result || m.recorded) return;
    const r = m.run.result;
    const today = isoDay();
    const lessons = { ...s.lessons };
    for (const id of new Set([...r.triggered, ...r.missed])) {
      const prev = lessons[id] ?? { status: 'unseen', hits: 0, catches: 0 };
      lessons[id] = { ...prev, status: 'hit', hits: prev.hits + 1, lastSeen: today };
    }
    for (const id of [...r.caught, ...(r.prevented ?? [])]) {
      const prev = lessons[id] ?? { status: 'unseen', hits: 0, catches: 0 };
      lessons[id] = { ...prev, status: 'caught', catches: prev.catches + 1, lastSeen: today };
    }
    const rec: RunRecord = {
      at: new Date().toISOString(),
      day: today,
      briefId: m.briefId,
      seed: m.seed,
      daily: m.daily,
      refly: m.attempt > 1,
      outcome: r.outcome,
      sciencePct: r.sciencePct,
      triggered: r.triggered,
      caught: r.caught,
      prevented: r.prevented ?? [],
      missed: r.missed,
      falseFlags: r.falseFlags,
    };
    const runs = [...s.runs, rec].slice(-200);
    let streak = s.streak;
    if (streak.last !== today) {
      const gap = streak.last ? dayDiff(streak.last, today) : 99;
      streak = { count: gap === 1 ? streak.count + 1 : 1, last: today };
    }
    const mission = { ...m, recorded: true };
    set({ lessons, runs, streak, mission });
    save(K.lessons, lessons);
    save(K.runs, runs);
    save(K.streak, streak);
    save(K.mission, mission);
  },

  refly() {
    const m = need();
    const slots = new Set<SlotId>();
    const lessonIds = new Set<string>();
    for (const e of m.run?.events ?? []) {
      if ((e.kind === 'failure' || e.kind === 'crisis') && e.lessonId) {
        lessonIds.add(e.lessonId);
        const s = e.anim ? ANIM_SLOT[e.anim] : undefined;
        if (s) slots.add(s);
      }
    }
    for (const id of [...(m.run?.result?.triggered ?? []), ...(m.run?.result?.missed ?? [])]) lessonIds.add(id);
    patchMission({
      run: null,
      recorded: false,
      flagged: [],
      fixed: [],
      refly: { slots: [...slots], lessons: [...lessonIds] },
      attempt: m.attempt + 1,
    });
  },
}));

function need(): Mission {
  const m = useGame.getState().mission;
  if (!m) throw new Error('no mission');
  return m;
}

function patchMission(p: Partial<Mission>) {
  const m = need();
  const mission = { ...m, ...p };
  useGame.setState({ mission });
  save(K.mission, persistable(mission));
}

/** The engine keeps live flight state in memory, so only finished runs survive a reload. */
function persistable(m: Mission): Mission {
  return m.run && !m.run.done ? { ...m, run: null } : m;
}

/** caught / (caught + missed) over all recorded runs. */
export function catchStats(runs: RunRecord[]) {
  let caught = 0;
  let missed = 0;
  for (const r of runs) {
    caught += r.caught.length;
    missed += r.missed.length;
  }
  const total = caught + missed;
  return { caught, missed, total, rate: total ? (caught / total) * 100 : null };
}

/* ---------- theme ---------- */
export type ThemePref = 'light' | 'dark' | null;
export function loadTheme(): ThemePref {
  return load<ThemePref>('flown.theme', null);
}
export function applyTheme(t: ThemePref) {
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  save('flown.theme', t);
  window.dispatchEvent(new Event('flown-theme'));
}
export function effectiveTheme(): 'light' | 'dark' {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'light' || a === 'dark') return a;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

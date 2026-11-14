import { create } from 'zustand';
import {
  defaultDesign,
  startFlight,
  resolveCrisis,
  decodeShare,
  MAX_PINS,
} from './eng';
import type {
  Design,
  Difficulty,
  FlightRun,
  FlightResult,
  LessonState,
  ProcessId,
  SlotId,
  FailureAnim,
} from './eng';
import { isoDay, dayDiff } from './format';
import { ownerOfGroup, pinsFor } from './coop';
import type { Group } from './coop';

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
  /** Crisis option ids picked this flight, in order (so a share link can replay the flight). */
  choices?: string[];
  /** Set when this mission is one player's turn in a crew game. */
  crewIndex?: number;
  /** Set when this mission answers a friend's share link. */
  challenge?: Challenge;
  /** Set when the whole crew builds and flies this one craft together. */
  coop?: boolean;
}

/** A friend's share link: the encoded design and seed, plus their pins, fixes and crisis picks. */
export interface Challenge {
  code: string;
  meta: string;
  mode: 'same' | 'own';
}

export interface CrewPlayer {
  name: string;
  done: boolean;
  design?: Design;
  result?: FlightResult;
}

export interface Crew {
  briefId: string;
  seed: number;
  players: CrewPlayer[];
  turn: number;
  startedAt: string;
  /** Difficulty every crew craft flies on. */
  difficulty?: Difficulty;
  /** 'race': one craft each, ranked. 'coop': one shared craft, roles split. Old saves are races. */
  mode?: 'race' | 'coop';
  coop?: CoopState;
}

export interface CoopState {
  /** Who holds the device right now. */
  active: number;
  ready: boolean[];
  /** GO / NO GO poll before launch: null means not polled yet. */
  go: (boolean | null)[];
  /** Review item id to the player whose pin it is. */
  pinOwner: Record<string, number>;
  /** Crisis calls made in flight. */
  calls: { lessonId: string; player: number; same: boolean | null }[];
}

function freshCoop(n: number): CoopState {
  return { active: 0, ready: Array(n).fill(false), go: Array(n).fill(null), pinOwner: {}, calls: [] };
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
  /** Player name when the run was a crew turn. */
  crew?: string;
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
  crew: Crew | null;
  /** Difficulty picked on the brief screen, used for every new mission. */
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  startCrew: (names: string[], briefId: string, difficulty?: Difficulty) => void;
  startCoop: (names: string[], briefId: string, difficulty?: Difficulty) => void;
  setActive: (i: number) => void;
  markReady: () => void;
  voteGo: (i: number, go: boolean) => void;
  coopCall: (lessonId: string, player: number, same: boolean | null) => void;
  beginCrewTurn: () => void;
  endCrew: () => void;
  startChallenge: (code: string, meta: string, mode: Challenge['mode']) => boolean;
  startMission: (briefId: string, seed: number, daily: boolean) => void;
  setPart: (slot: SlotId, id: string) => void;
  toggleInstrument: (id: string, max: number) => void;
  setProcess: (p: ProcessId, id: string) => void;
  setLaunch: (id: string) => void;
  setOrbit: (id: string) => void;
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

const K = { mission: 'flown.mission', lessons: 'flown.lessons', runs: 'flown.runs', streak: 'flown.streak', crew: 'flown.crew', difficulty: 'flown.difficulty' };

const DIFFS: Difficulty[] = ['cadet', 'engineer', 'veteran'];
function loadDifficulty(): Difficulty {
  const d = load<string>(K.difficulty, 'engineer');
  return (DIFFS as string[]).includes(d) ? (d as Difficulty) : 'engineer';
}

function designFor(briefId: string, difficulty: Difficulty): Design {
  return { ...defaultDesign(briefId), difficulty };
}

function freshMission(briefId: string, seed: number, daily: boolean, extra: Partial<Mission> = {}, difficulty: Difficulty = 'engineer'): Mission {
  return {
    briefId,
    seed,
    daily,
    design: designFor(briefId, difficulty),
    flagged: [],
    fixed: [],
    run: null,
    recorded: false,
    refly: null,
    attempt: 1,
    choices: [],
    ...extra,
  };
}

export const useGame = create<State>((set, get) => ({
  mission: load<Mission | null>(K.mission, null),
  lessons: load<Record<string, LessonState>>(K.lessons, {}),
  runs: load<RunRecord[]>(K.runs, []),
  streak: load<Streak>(K.streak, { count: 0, last: null }),
  crew: load<Crew | null>(K.crew, null),
  difficulty: loadDifficulty(),

  setDifficulty(difficulty) {
    set({ difficulty });
    save(K.difficulty, difficulty);
  },

  startCrew(names, briefId, difficulty) {
    const crew: Crew = {
      briefId,
      seed: Math.floor(Math.random() * 100000),
      players: names.map((name) => ({ name, done: false })),
      turn: 0,
      startedAt: new Date().toISOString(),
      difficulty: difficulty ?? get().difficulty,
    };
    set({ crew });
    save(K.crew, crew);
  },

  startCoop(names, briefId, difficulty) {
    const crew: Crew = {
      briefId,
      seed: Math.floor(Math.random() * 100000),
      players: names.map((name) => ({ name, done: false })),
      turn: 0,
      startedAt: new Date().toISOString(),
      difficulty: difficulty ?? get().difficulty,
      mode: 'coop',
      coop: freshCoop(names.length),
    };
    const mission = freshMission(briefId, crew.seed, false, { coop: true }, crew.difficulty ?? 'engineer');
    set({ crew, mission });
    save(K.crew, crew);
    save(K.mission, persistable(mission));
  },

  setActive(i) {
    const c = coopCrew();
    if (!c || i < 0 || i >= c.players.length) return;
    patchCoop({ active: i });
  },

  markReady() {
    const c = coopCrew();
    if (!c?.coop) return;
    const ready = c.coop.ready.map((r, i) => r || i === c.coop!.active);
    const n = ready.length;
    let active = c.coop.active;
    for (let k = 1; k <= n; k++) {
      const j = (c.coop.active + k) % n;
      if (!ready[j]) { active = j; break; }
    }
    if (ready.every(Boolean)) active = 0;
    patchCoop({ ready, active });
  },

  voteGo(i, go) {
    const c = coopCrew();
    if (!c?.coop) return;
    patchCoop({ go: c.coop.go.map((v, j) => (j === i ? go : v)) });
  },

  coopCall(lessonId, player, same) {
    const c = coopCrew();
    if (!c?.coop) return;
    patchCoop({ calls: [...c.coop.calls, { lessonId, player, same }] });
  },

  beginCrewTurn() {
    const crew = get().crew;
    if (!crew || crew.turn >= crew.players.length) return;
    const mission = freshMission(crew.briefId, crew.seed, false, { crewIndex: crew.turn }, crew.difficulty ?? 'engineer');
    set({ mission });
    save(K.mission, persistable(mission));
  },

  endCrew() {
    const m = get().mission;
    const mission = m && (m.crewIndex !== undefined || m.coop) ? null : m;
    set({ crew: null, mission });
    save(K.crew, null);
    save(K.mission, mission ? persistable(mission) : null);
  },

  startChallenge(code, meta, mode) {
    const dec = decodeShare(code);
    if (!dec) return false;
    const mission = freshMission(dec.design.briefId, dec.seed, false, {
      design: mode === 'same' ? { ...dec.design, fixes: [] } : designFor(dec.design.briefId, dec.design.difficulty ?? 'engineer'),
      challenge: { code, meta, mode },
    });
    set({ mission });
    save(K.mission, persistable(mission));
    return true;
  },

  startMission(briefId, seed, daily) {
    const mission = freshMission(briefId, seed, daily, {}, get().difficulty);
    set({ mission });
    save(K.mission, persistable(mission));
  },

  setPart(slot, id) {
    if (need().design.parts[slot] === id || !coopMay(slot)) return;
    patchMission({ design: { ...need().design, parts: { ...need().design.parts, [slot]: id } } });
  },

  toggleInstrument(id, max) {
    const d = need().design;
    const has = d.instruments.includes(id);
    if (!has && d.instruments.length >= max) return;
    if (!coopMay('instruments')) return;
    if (!has && d.instruments.length >= max) return;
    const instruments = has ? d.instruments.filter((x) => x !== id) : [...d.instruments, id];
    patchMission({ design: { ...d, instruments } });
  },

  setProcess(p, id) {
    if (need().design.process[p] === id || !coopMay('process')) return;
    const d = need().design;
    patchMission({ design: { ...d, process: { ...d.process, [p]: id } } });
  },

  setLaunch(id) {
    if (need().design.launch === id || !coopMay('launch')) return;
    patchMission({ design: { ...need().design, launch: id } });
  },

  setOrbit(id) {
    if (need().design.orbit === id || !coopMay('orbit')) return;
    patchMission({ design: { ...need().design, orbit: id } });
  },

  toggleFlag(id) {
    const m = need();
    const on = m.flagged.includes(id);
    const c = m.coop ? coopCrew() : null;
    if (c?.coop) {
      const { active, pinOwner } = c.coop;
      const quota = pinsFor(c.players.length)[active] ?? 1;
      const mine = m.flagged.filter((f) => (pinOwner[f] ?? 0) === active).length;
      if (on && (pinOwner[id] ?? 0) !== active) return;
      if (!on && (mine >= quota || m.flagged.length >= MAX_PINS)) return;
      const next = { ...pinOwner };
      if (on) delete next[id];
      else next[id] = active;
      patchCoop({ pinOwner: next, go: c.coop.go.map(() => null) });
      patchMission({
        flagged: on ? m.flagged.filter((x) => x !== id) : [...m.flagged, id],
        fixed: on ? m.fixed.filter((x) => x !== id) : m.fixed,
      });
      return;
    }
    if (!on && m.flagged.length >= MAX_PINS) return;
    patchMission({
      flagged: on ? m.flagged.filter((x) => x !== id) : [...m.flagged, id],
      fixed: on ? m.fixed.filter((x) => x !== id) : m.fixed,
    });
  },

  setFix(id, on) {
    const m = need();
    const fixed = on ? Array.from(new Set([...m.fixed, id])) : m.fixed.filter((x) => x !== id);
    const c = m.coop ? coopCrew() : null;
    if (c?.coop) patchCoop({ go: c.coop.go.map(() => null) });
    patchMission({ fixed });
  },

  launch() {
    const m = get().mission;
    if (!m) return null;
    const run = startFlight(m.design, m.seed, m.flagged, m.fixed);
    patchMission({ run, recorded: false, choices: [] });
    return run;
  },

  resolve(optionId) {
    const m = need();
    if (!m.run) return;
    const before = m.run;
    const run = resolveCrisis(before, optionId);
    if (run === before) return;
    patchMission({ run, choices: [...(m.choices ?? []), optionId] });
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
    let crew = s.crew;
    if (m.crewIndex !== undefined && crew && crew.briefId === m.briefId && crew.seed === m.seed) {
      const p = crew.players[m.crewIndex];
      if (p && !p.done) {
        rec.crew = p.name;
        const players = crew.players.map((x, i) => (i === m.crewIndex ? { ...x, done: true, design: m.run!.design, result: r } : x));
        crew = { ...crew, players, turn: Math.max(crew.turn, m.crewIndex + 1) };
      }
    }
    const runs = [...s.runs, rec].slice(-200);
    let streak = s.streak;
    if (streak.last !== today) {
      const gap = streak.last ? dayDiff(streak.last, today) : 99;
      streak = { count: gap === 1 ? streak.count + 1 : 1, last: today };
    }
    const mission = { ...m, recorded: true };
    set({ lessons, runs, streak, mission, crew });
    save(K.crew, crew);
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
    const c = m.coop ? coopCrew() : null;
    if (c) patchCoop({ ...freshCoop(c.players.length) });
    patchMission({
      run: null,
      recorded: false,
      flagged: [],
      fixed: [],
      choices: [],
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

/** The crew when the current mission is a one craft crew game. */
export function coopCrew(): Crew | null {
  const { mission, crew } = useGame.getState();
  return mission?.coop && crew?.mode === 'coop' && crew.coop && crew.briefId === mission.briefId ? crew : null;
}

function patchCoop(p: Partial<CoopState>) {
  const crew = useGame.getState().crew;
  if (!crew?.coop) return;
  const next: Crew = { ...crew, coop: { ...crew.coop, ...p } };
  useGame.setState({ crew: next });
  save(K.crew, next);
}

/** In a one craft game only the owner of a group may change it, and any change clears every ready and GO. */
function coopMay(g: Group): boolean {
  const c = coopCrew();
  if (!c?.coop) return true;
  if (ownerOfGroup(c.players.length, g) !== c.coop.active) return false;
  patchCoop({ ready: c.coop.ready.map(() => false), go: c.coop.go.map(() => null) });
  return true;
}

/** The engine keeps live flight state in memory, so only finished runs survive a reload. */
function persistable(m: Mission): Mission {
  return m.run && !m.run.done ? { ...m, run: null } : m;
}

/** caught / (caught + missed + wrong pins) over all recorded runs, the same rule as the engine's catchRate. */
export function catchStats(runs: RunRecord[]) {
  let caught = 0;
  let missed = 0;
  let wrong = 0;
  for (const r of runs) {
    caught += r.caught.length;
    missed += r.missed.length;
    wrong += r.falseFlags?.length ?? 0;
  }
  const total = caught + missed + wrong;
  return { caught, missed, wrong, total, rate: caught + missed ? (caught / total) * 100 : null };
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

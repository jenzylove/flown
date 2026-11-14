import lessonsData from '../data/lessons.json';
import nssdcaData from '../data/nssdca.json';
import {
  BATTERY_WH, BRIEFS, DOWNLINK_MB, FIXED_COST_SHARE, FUEL_MASS_FACTOR, INSTRUMENTS, NEED_CLASS,
  PARTS, PROCESS_OPTIONS, PROP_CLASS, STRUCTURE_SHARE,
} from './catalog';
import { REVIEW_FIXES, RULES, ruleFor, type Ctx, type Effect, type Rule } from './rules';
import type {
  Brief, BudgetReport, ColdOpen, Crisis, Design, FlightEvent, FlightResult, FlightRun, Lesson,
  ReviewItem, SlotId,
} from './types';

export * from './types';
export { BRIEFS, PARTS, INSTRUMENTS, PROCESS_OPTIONS, RULES, REVIEW_FIXES };

export const LESSONS = lessonsData as Lesson[];
export interface RealCraft {
  nssdca_id: string; name: string; launch_date: string | null; launch_vehicle: string | null;
  mass_kg: number | null; power_w: number | null; source: string;
}
export const REAL_CRAFT = nssdcaData as Record<string, RealCraft>;

/** Lesson ids that can happen in the game (the rest are in the library on /proof). */
export const PLAYABLE_LESSONS = RULES.map(r => r.lessonId);

export const SLOTS: SlotId[] = ['power', 'battery', 'antenna', 'attitude', 'propulsion', 'computer', 'thermal'];

export const partById = (id: string) => PARTS.find(p => p.id === id);
export const instrumentById = (id: string) => INSTRUMENTS.find(p => p.id === id);
export const lessonById = (id: string) => LESSONS.find(l => l.id === id);
export const briefById = (id: string) => {
  const b = BRIEFS.find(x => x.id === id);
  if (!b) throw new Error(`unknown brief ${id}`);
  return b;
};
const proc = (id: string) => PROCESS_OPTIONS.find(p => p.id === id)!;

// ---------- seeded randomness ----------
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Deterministic number in [0,1) for a seed and a key. */
export function roll(seed: number, key: string) {
  let x = hash(`${seed}:${key}`) || 1;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

// ---------- design ----------
export function defaultDesign(briefId: string): Design {
  const b = briefById(briefId);
  const far = b.sunFactor < 0.05;
  return {
    briefId,
    parts: {
      power: far ? (b.sunFactor < 0.01 ? 'rtg' : 'panel_wings') : 'panel_large',
      battery: 'battery_m',
      antenna: 'hga_fixed',
      attitude: 'wheels_4',
      propulsion: b.deltaVNeed === 'high' ? 'biprop' : b.deltaVNeed === 'medium' ? 'mono_large' : 'mono_small',
      computer: 'cpu_single',
      thermal: b.sunFactor > 3 || b.sunFactor < 0.05 ? 'thermal_full' : 'thermal_basic',
    },
    instruments: b.kind === 'telescope' ? ['telescope'] : b.kind === 'lander' ? ['seismometer', 'camera'] : ['camera', 'magnetometer'],
    process: { interfaceCheck: 'ic_spot', deployTest: 'dt_part', faultSim: 'fs_basic', fuelMargin: 'fm_10' },
    fixes: [],
  };
}

export function evaluate(design: Design): BudgetReport {
  const b = briefById(design.briefId);
  const parts = SLOTS.map(s => partById(design.parts[s])!).filter(Boolean);
  const inst = design.instruments.map(i => instrumentById(i)!).filter(Boolean);
  const procs = Object.values(design.process).map(proc);

  const rawMass = parts.reduce((a, p) => a + p.massKg, 0) + inst.reduce((a, i) => a + i.massKg, 0);
  const propPart = partById(design.parts.propulsion)!;
  const fuelExtra = propPart.massKg * (FUEL_MASS_FACTOR[design.process.fuelMargin] ?? 0);
  const massKg = Math.round((rawMass + fuelExtra) * (1 + STRUCTURE_SHARE));

  const fixes = (design.fixes ?? []).map(f => REVIEW_FIXES[f]).filter(Boolean) as NonNullable<ReviewItem['fix']>[];
  const costM = Math.round(
    b.budgetM * FIXED_COST_SHARE +
    parts.reduce((a, p) => a + p.costM, 0) + inst.reduce((a, i) => a + i.costM, 0) +
    procs.reduce((a, p) => a + p.costM, 0) + fixes.reduce((a, f) => a + f.costM, 0),
  );

  const power = partById(design.parts.power)!;
  const powerGenW = Math.round(power.id === 'rtg' ? power.powerW : power.powerW * b.sunFactor);
  const ion = design.parts.propulsion === 'ion';
  const powerUseW = Math.round(
    parts.filter(p => p.powerW < 0 && !(ion && p.id === 'ion')).reduce((a, p) => a - p.powerW, 0) +
    inst.reduce((a, i) => a + i.powerW, 0),
  );
  const batteryWh = BATTERY_WH[design.parts.battery] ?? 0;
  const batteryHours = +(batteryWh / Math.max(1, powerUseW)).toFixed(1);
  // orbit periods: Mars ~2 h, Mercury ~12 h, lander night ~12 h of a 24.6 h sol
  const periodH = b.kind === 'lander' ? 24.6 : b.target === 'Mercury' ? 12 : 2;
  const eclipseHours = +(periodH * b.eclipseFraction).toFixed(1);
  const dataMbDay = inst.reduce((a, i) => a + i.dataMbDay, 0);
  const downlinkMbDay = Math.round((DOWNLINK_MB[design.parts.antenna] ?? 0) * b.linkFactor);
  const scheduleDays = procs.reduce((a, p) => a + p.scheduleDays, 0) + fixes.reduce((a, f) => a + f.scheduleDays, 0);

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (massKg > b.launchMassLimitKg) blockers.push(`Too heavy: ${massKg} kg, the rocket can send ${b.launchMassLimitKg} kg to ${b.target}.`);
  if (costM > b.budgetM) blockers.push(`Over budget: $${costM}M of $${b.budgetM}M.`);
  if (powerGenW < powerUseW) blockers.push(`Not enough power at ${b.target}: ${powerGenW} W made, ${powerUseW} W needed.`);
  if (ion && power.powerW * b.sunFactor < 2500 && power.id !== 'rtg') blockers.push('The ion engine needs about 2500 W while thrusting. Your power source cannot feed it.');
  if (ion && power.id === 'rtg') blockers.push('One RTG cannot feed an ion engine.');
  if (PROP_CLASS[design.parts.propulsion] < NEED_CLASS[b.deltaVNeed]) blockers.push(`Your engine cannot change speed enough to reach ${b.target}.`);
  if ((b.sunFactor > 3 || b.sunFactor < 0.05) && design.parts.thermal === 'thermal_basic') blockers.push(`${b.target} is too ${b.sunFactor > 3 ? 'hot' : 'cold'} for basic thermal control.`);
  if (scheduleDays > b.scheduleSlackDays) blockers.push(`Too slow: ${scheduleDays} days of testing, the launch window closes in ${b.scheduleSlackDays}.`);
  if (inst.length === 0) blockers.push('Add at least one instrument. No instruments, no science.');
  if (inst.length > b.maxInstruments) blockers.push(`This craft has room for ${b.maxInstruments} instruments.`);
  if (design.instruments.includes('seismometer') && b.kind !== 'lander') blockers.push('A seismometer only works on the ground.');
  if (design.instruments.includes('telescope') && b.kind === 'lander') blockers.push('A space telescope does not belong on a lander.');
  if (dataMbDay > downlinkMbDay) warnings.push(`Your instruments make ${dataMbDay} Mb a day but you can send home ${downlinkMbDay}. Some science will never reach Earth.`);
  if (b.eclipseFraction > 0 && batteryHours < eclipseHours) warnings.push(`The battery lasts ${batteryHours} h; the shadow lasts ${eclipseHours} h.`);
  return {
    massKg, massLimitKg: b.launchMassLimitKg, costM, budgetM: b.budgetM, powerGenW, powerUseW,
    batteryHours, eclipseHours, dataMbDay, downlinkMbDay, scheduleDays, blockers, warnings,
  };
}

function ctxFor(design: Design): Ctx {
  return {
    design, brief: briefById(design.briefId), report: evaluate(design),
    part: s => design.parts[s], proc: p => design.process[p],
  };
}

const SLOT_LABEL: Record<SlotId, string> = {
  power: 'Power', battery: 'Battery', antenna: 'Antenna', attitude: 'Pointing', propulsion: 'Engine', computer: 'Computer', thermal: 'Thermal',
};

export function reviewItems(design: Design): ReviewItem[] {
  const items: ReviewItem[] = SLOTS.map(s => ({
    id: `part:${s}`, slot: s, label: `${SLOT_LABEL[s]}: ${partById(design.parts[s])?.name}`, fix: REVIEW_FIXES[`part:${s}`],
  }));
  items.push({ id: 'part:instruments', label: `Instruments: ${design.instruments.map(i => instrumentById(i)?.name).join(', ')}`, fix: REVIEW_FIXES['part:instruments'] });
  for (const p of ['interfaceCheck', 'deployTest', 'faultSim', 'fuelMargin'] as const) {
    items.push({ id: `process:${p}`, label: proc(design.process[p]).label, fix: REVIEW_FIXES[`process:${p}`] });
  }
  return items;
}

/** The fixes are recorded on the design; evaluate() charges their cost and schedule. */
export function applyFixes(design: Design, fixed: string[]): Design {
  return { ...design, fixes: [...new Set(fixed)] };
}

/** Which rules would hit this design on this seed (before fixes). Pure, used by the sim and tests. */
export function wouldTrigger(design: Design, seed: number): Rule[] {
  const c = ctxFor({ ...design, fixes: [] });
  return RULES.filter(r => roll(seed, r.lessonId) < r.p(c));
}

/** Every real failure this design could suffer, with its chance per flight. */
export function riskProfile(design: Design) {
  const c = ctxFor({ ...design, fixes: [] });
  return RULES.map(r => ({ lessonId: r.lessonId, item: r.item, p: r.p(c) })).filter(x => x.p > 0);
}

// ---------- flight ----------
interface Internal {
  queue: { rule?: Rule; ev: FlightEvent }[];
  mults: number[];
  lostAtDay: number | null;
  triggered: string[];
  caught: string[];
  prevented: string[];
  missed: string[];
  falseFlags: string[];
}
const STATE = new WeakMap<FlightRun, Internal>();

function dayFor(phase: FlightEvent['phase'], b: Brief, seed: number, key: string) {
  const r = roll(seed, `day:${key}`);
  switch (phase) {
    case 'launch': return 0;
    case 'cruise': return Math.round(30 + r * Math.max(1, b.arrivalDay - 60));
    case 'arrival': return b.arrivalDay;
    case 'operations': return Math.round(b.arrivalDay + 10 + r * (b.missionDays - b.arrivalDay) * 0.8);
    case 'end': return Math.round(b.missionDays * 0.97);
  }
}

export function startFlight(design: Design, seed: number, flagged: string[], fixed: string[]): FlightRun {
  const b = briefById(design.briefId);
  const hits = wouldTrigger(design, seed);
  const fixedSet = new Set(fixed);
  const flagSet = new Set(flagged);
  const st: Internal = { queue: [], mults: [], lostAtDay: null, triggered: [], caught: [], prevented: [], missed: [], falseFlags: [] };
  const riskItems = new Set(riskProfile(design).map(r => r.item));
  st.falseFlags = flagged.filter(f => !riskItems.has(f));

  const evs: { rule?: Rule; ev: FlightEvent }[] = [
    { ev: { day: 0, phase: 'launch', kind: 'nominal', text: `Launch. The craft separates from the rocket and heads for ${b.target}.` } },
    { ev: { day: Math.round(b.arrivalDay / 2), phase: 'cruise', kind: 'nominal', text: 'Cruise. Systems check out. The team waits.' } },
    { ev: { day: b.arrivalDay, phase: 'arrival', kind: 'nominal', text: b.kind === 'lander' ? 'Entry, descent and landing.' : b.kind === 'flyby' ? `Closest approach to ${b.target}.` : b.kind === 'telescope' ? 'The telescope settles in and starts staring.' : `Arrival burn at ${b.target}.` } },
    { ev: { day: b.missionDays, phase: 'end', kind: 'nominal', text: 'End of the planned mission.' } },
  ];
  for (const r of hits) {
    if (flagSet.has(r.item)) st.caught.push(r.lessonId);
    else st.missed.push(r.lessonId);
    if (fixedSet.has(r.item)) {
      st.prevented.push(r.lessonId);
      evs.push({ ev: { day: dayFor(r.phase, b, seed, r.lessonId), phase: r.phase, kind: 'save', lessonId: r.lessonId, text: `Your pre launch fix held. ${lessonById(r.lessonId)?.mission ?? 'A real mission'} was not so lucky.` } });
      continue;
    }
    evs.push({ rule: r, ev: { day: dayFor(r.phase, b, seed, r.lessonId), phase: r.phase, kind: r.crisis ? 'crisis' : 'failure', lessonId: r.lessonId, text: r.text, anim: r.anim } });
  }
  const order = { launch: 0, cruise: 1, arrival: 2, operations: 3, end: 4 } as const;
  evs.sort((a, z) => a.ev.day - z.ev.day || order[a.ev.phase] - order[z.ev.phase] || (a.ev.kind === 'nominal' ? -1 : 1));
  st.queue = evs;
  const run: FlightRun = { seed, design: { ...design, fixes: fixed }, events: [], done: false };
  STATE.set(run, st);
  return advance(run);
}

function applyEffect(st: Internal, e: Effect, day: number) {
  if (e.kind === 'lost') st.lostAtDay = day;
  else if (e.kind === 'degrade') st.mults.push(e.mult);
}

function advance(run: FlightRun): FlightRun {
  const st = STATE.get(run)!;
  const c = ctxFor(run.design);
  const events = [...run.events];
  while (st.queue.length && st.lostAtDay === null) {
    const { rule, ev } = st.queue.shift()!;
    events.push(ev);
    if (!rule) continue;
    st.triggered.push(rule.lessonId);
    if (rule.crisis) {
      const crisis: Crisis = {
        lessonId: rule.lessonId, day: ev.day, prompt: rule.crisis.prompt,
        options: rule.crisis.options.map(o => {
          const a = o.available(c);
          return { id: o.id, label: o.label, available: a === true, why: a === true ? undefined : a };
        }),
      };
      const next: FlightRun = { ...run, events, pendingCrisis: crisis };
      STATE.set(next, st);
      return next;
    }
    if (rule.effect) applyEffect(st, rule.effect, ev.day);
  }
  const done: FlightRun = { ...run, events, pendingCrisis: undefined, done: true, result: finish(run.design, st) };
  if (st.lostAtDay !== null) done.events.push({ day: st.lostAtDay, phase: 'end', kind: 'failure', text: 'Contact lost. The mission is over.', anim: 'signal_lost' });
  STATE.set(done, st);
  return done;
}

export function resolveCrisis(run: FlightRun, optionId: string): FlightRun {
  const st = STATE.get(run);
  if (!st || !run.pendingCrisis) return run;
  const rule = ruleFor(run.pendingCrisis.lessonId)!;
  const opt = rule.crisis!.options.find(o => o.id === optionId);
  const avail = run.pendingCrisis.options.find(o => o.id === optionId)?.available;
  if (!opt || !avail) return run;
  applyEffect(st, opt.effect, run.pendingCrisis.day);
  const events: FlightEvent[] = [...run.events, { day: run.pendingCrisis.day, phase: 'operations', kind: opt.effect.kind === 'lost' ? 'failure' : 'nominal', lessonId: rule.lessonId, text: opt.after }];
  const next: FlightRun = { ...run, events, pendingCrisis: undefined };
  STATE.set(next, st);
  return advance(next);
}

/** What NASA really chose in this crisis, for the reveal. */
export function nasaChoice(lessonId: string) {
  const r = ruleFor(lessonId);
  return r?.crisis ? { optionId: r.crisis.nasaChoice, text: r.crisis.nasaLabel } : null;
}

function finish(design: Design, st: Internal): FlightResult {
  const b = briefById(design.briefId);
  const rep = evaluate(design);
  // A flyby gathers data for days and sends it home for months, so its downlink gets that time.
  const sendDays = b.kind === 'flyby' ? 30 : 1;
  const dataRatio = rep.dataMbDay === 0 ? 0 : Math.min(1, (rep.downlinkMbDay * sendDays) / rep.dataMbDay);
  let frac = 1;
  if (st.lostAtDay !== null) {
    frac = st.lostAtDay <= b.arrivalDay ? 0 : (st.lostAtDay - b.arrivalDay) / Math.max(1, b.missionDays - b.arrivalDay);
  }
  const mult = st.mults.reduce((a, m) => a * m, 1);
  const sciencePct = Math.round(100 * dataRatio * mult * frac);
  const outcome: FlightResult['outcome'] = st.lostAtDay !== null && frac < 0.5 ? 'lost' : sciencePct >= 90 ? 'success' : 'degraded';
  return { outcome, sciencePct, triggered: st.triggered, caught: st.caught, prevented: st.prevented, missed: st.missed, falseFlags: st.falseFlags };
}

// ---------- daily ----------
export function dailyBrief(date: Date): { brief: Brief; seed: number } {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  const h = hash(`daily:${key}`);
  return { brief: BRIEFS[h % BRIEFS.length], seed: h % 100000 };
}

/** Catch rate over many runs: caught / (caught + missed). null when nothing could have been caught yet. */
export function catchRate(results: Pick<FlightResult, 'caught' | 'missed'>[]) {
  const c = results.reduce((a, r) => a + r.caught.length, 0);
  const m = results.reduce((a, r) => a + r.missed.length, 0);
  return c + m === 0 ? null : c / (c + m);
}

// ---------- cold open ----------
const juno = LESSONS.find(l => l.id === 'juno-helium-check-valves');
export const COLD_OPENS: ColdOpen[] = [
  {
    id: 'juno-2016', lessonId: 'juno-helium-check-valves', craft: 'juno', dateLabel: 'October 2016, in orbit around Jupiter',
    setup: [
      'Juno is in a 53 day orbit around Jupiter.',
      'Next: an engine burn to tighten it to a 14 day science orbit.',
      'Two helium check valves in the engine’s pressure system opened slowly. They should open in seconds. They took minutes.',
    ],
    prompt: 'You are in charge. Fire the engine as planned, or stay in the long orbit?',
    options: [
      { id: 'burn', label: 'Fire the engine as planned', consequence: 'If the valves misbehave mid burn, the engine could leave Juno in an orbit nobody planned for.' },
      { id: 'stay', label: 'Stay in the 53 day orbit', consequence: 'Fewer close passes over the mission, but no risky burn at all.' },
    ],
    nasaChoice: 'stay',
    nasaWhy: 'On February 17, 2017 NASA announced Juno would stay in its 53 day orbit. The longer orbit gave fewer close passes, but it also kept the craft out of the worst radiation.',
    sources: juno?.sources ?? [],
  },
];

// ---------- calibration: Flown mass rules vs real spacecraft ----------
/** A Flown design that resembles each real craft, so its mass can be compared with NSSDCA. */
export const REFERENCE_DESIGNS: Record<string, Design> = {
  jupiter: { briefId: 'jupiter', parts: { power: 'panel_wings', battery: 'battery_m', antenna: 'hga_fixed', attitude: 'wheels_hybrid', propulsion: 'biprop', computer: 'cpu_dual', thermal: 'thermal_full' }, instruments: ['magnetometer', 'camera', 'spectrometer', 'particle'], process: { interfaceCheck: 'ic_full', deployTest: 'dt_full', faultSim: 'fs_basic', fuelMargin: 'fm_10' } },
  'mars-orbit': { briefId: 'mars-orbit', parts: { power: 'panel_wings', battery: 'battery_l', antenna: 'hga_fixed', attitude: 'wheels_4', propulsion: 'mono_large', computer: 'cpu_dual', thermal: 'thermal_basic' }, instruments: ['camera', 'spectrometer', 'radar', 'particle'], process: { interfaceCheck: 'ic_full', deployTest: 'dt_full', faultSim: 'fs_none', fuelMargin: 'fm_0' } },
  planets: { briefId: 'planets', parts: { power: 'panel_large', battery: 'battery_s', antenna: 'hga_fixed', attitude: 'wheels_4', propulsion: 'mono_small', computer: 'cpu_dual', thermal: 'thermal_basic' }, instruments: ['telescope'], process: { interfaceCheck: 'ic_full', deployTest: 'dt_part', faultSim: 'fs_basic', fuelMargin: 'fm_0' } },
  pluto: { briefId: 'pluto', parts: { power: 'rtg', battery: 'battery_s', antenna: 'hga_fixed', attitude: 'wheels_3', propulsion: 'mono_small', computer: 'cpu_dual', thermal: 'thermal_full' }, instruments: ['camera', 'spectrometer'], process: { interfaceCheck: 'ic_full', deployTest: 'dt_part', faultSim: 'fs_basic', fuelMargin: 'fm_0' } },
  mercury: { briefId: 'mercury', parts: { power: 'panel_small', battery: 'battery_s', antenna: 'hga_fixed', attitude: 'wheels_4', propulsion: 'biprop', computer: 'cpu_dual', thermal: 'thermal_full' }, instruments: ['camera', 'spectrometer', 'magnetometer'], process: { interfaceCheck: 'ic_full', deployTest: 'dt_part', faultSim: 'fs_basic', fuelMargin: 'fm_10' } },
  'mars-land': { briefId: 'mars-land', parts: { power: 'panel_small', battery: 'battery_m', antenna: 'lga', attitude: 'wheels_3', propulsion: 'mono_large', computer: 'cpu_dual', thermal: 'thermal_basic' }, instruments: ['seismometer', 'camera'], process: { interfaceCheck: 'ic_full', deployTest: 'dt_part', faultSim: 'fs_basic', fuelMargin: 'fm_0' } },
};

export function calibration() {
  return BRIEFS.map(b => {
    const real = REAL_CRAFT[b.realCraft];
    const flown = evaluate(REFERENCE_DESIGNS[b.id]).massKg;
    const realMass = real?.mass_kg ?? null;
    const errPct = realMass ? Math.round((100 * (flown - realMass)) / realMass) : null;
    return { brief: b.id, craft: real?.name ?? b.realCraft, realMassKg: realMass, flownMassKg: flown, errPct, source: real?.source };
  });
}

// ---------- share codes ----------
/** Compact, URL safe code for a design plus seed, so a friend can fly the same mission. */
export function encodeShare(design: Design, seed: number): string {
  const d = [design.briefId, ...SLOTS.map(s => design.parts[s]), design.instruments.join('+'),
    design.process.interfaceCheck, design.process.deployTest, design.process.faultSim, design.process.fuelMargin, String(seed)];
  return d.join('.');
}
export function decodeShare(code: string): { design: Design; seed: number } | null {
  const p = code.split('.');
  if (p.length !== 1 + SLOTS.length + 1 + 4 + 1) return null;
  const [briefId, ...rest] = p;
  if (!BRIEFS.some(b => b.id === briefId)) return null;
  const parts = Object.fromEntries(SLOTS.map((s, i) => [s, rest[i]])) as Design['parts'];
  if (SLOTS.some(s => partById(parts[s])?.slot !== s)) return null;
  const instruments = rest[SLOTS.length] ? rest[SLOTS.length].split('+') : [];
  if (instruments.some(i => !instrumentById(i))) return null;
  const [ic, dt, fs, fm, seedS] = rest.slice(SLOTS.length + 1);
  const ok = (id: string, pr: string) => PROCESS_OPTIONS.some(o => o.id === id && o.process === pr);
  if (!ok(ic, 'interfaceCheck') || !ok(dt, 'deployTest') || !ok(fs, 'faultSim') || !ok(fm, 'fuelMargin')) return null;
  const seed = Number(seedS);
  if (!Number.isInteger(seed) || seed < 0) return null;
  return { design: { briefId, parts, instruments, process: { interfaceCheck: ic, deployTest: dt, faultSim: fs, fuelMargin: fm }, fixes: [] }, seed };
}

/** Crew score: science that came home, plus a bonus for each real failure caught before launch. */
export function crewScore(r: FlightResult) {
  return r.sciencePct + 15 * r.caught.length - 5 * r.missed.length;
}

// Shared contract between the engine (src/engine, src/data) and the UI (src/ui, src/three).
// The engine is pure: no DOM, no randomness outside the seeded RNG, no network.

export type SlotId =
  | 'power'
  | 'battery'
  | 'antenna'
  | 'attitude'
  | 'propulsion'
  | 'computer'
  | 'thermal';

export interface Part {
  id: string;
  slot: SlotId;
  name: string;
  massKg: number;
  /** Positive = generates watts at 1 AU (solar) or fixed (RTG). Negative = draws watts. */
  powerW: number;
  costM: number;
  /** One plain sentence shown in the hangar. */
  blurb: string;
  /** Visual hint for the 3D craft builder. */
  look: PartLook;
}

export type PartLook =
  | 'panel_small' | 'panel_large' | 'panel_wings' | 'rtg'
  | 'battery_s' | 'battery_m' | 'battery_l'
  | 'lga' | 'hga_fixed' | 'hga_deployable'
  | 'wheels_3' | 'wheels_4' | 'wheels_hybrid'
  | 'mono_small' | 'mono_large' | 'biprop' | 'ion'
  | 'cpu_single' | 'cpu_dual'
  | 'thermal_basic' | 'thermal_full';

export interface Instrument {
  id: string;
  name: string;
  massKg: number;
  powerW: number; // draw, positive number
  costM: number;
  /** Data generated per day, megabits. */
  dataMbDay: number;
  /** Science points if it operates the whole mission. */
  science: number;
  blurb: string;
  look: 'camera' | 'spectrometer' | 'magnetometer' | 'radar' | 'telescope' | 'particle';
}

/** Engineering process choices: they cost budget and schedule, and they are where many real lessons live. */
export type ProcessId = 'interfaceCheck' | 'deployTest' | 'faultSim' | 'fuelMargin';

export interface ProcessOption {
  id: string;
  process: ProcessId;
  label: string;
  costM: number;
  scheduleDays: number;
  blurb: string;
}

export interface Brief {
  id: string;
  title: string;          // "Orbit Jupiter"
  target: string;         // "Jupiter"
  goal: string;           // one sentence science goal
  story: string;          // one sentence human framing
  budgetM: number;        // cost cap or real cost, see budgetNote
  budgetNote: string;     // e.g. "Real Juno cost, not a cap"
  launchMassLimitKg: number; // dry mass the era rocket can send there (simplified, sourced in note)
  sunFactor: number;      // sunlight relative to Earth (1 at 1 AU, 0.037 at Jupiter)
  eclipseFraction: number; // share of each orbit in shadow (0 for cruise only targets)
  missionDays: number;
  deltaVNeed: 'low' | 'medium' | 'high';
  realCraft: string;      // key into src/data/nssdca.json
  maxInstruments: number;
  /** Downlink strength relative to a craft near Earth (distance and dish size of the era, simplified). */
  linkFactor: number;
  /** Days of slack before the launch window closes: process work must fit inside it. */
  scheduleSlackDays: number;
  /** Day the craft reaches the target. */
  arrivalDay: number;
  kind: 'orbiter' | 'flyby' | 'lander' | 'telescope';
}

export interface Design {
  briefId: string;
  parts: Record<SlotId, string>; // part id per slot
  instruments: string[];         // instrument ids
  process: Record<ProcessId, string>; // process option id per process
  /** Review item ids the player paid to fix before launch. */
  fixes?: string[];
}

export interface BudgetReport {
  massKg: number;
  massLimitKg: number;
  costM: number;
  budgetM: number;
  powerGenW: number;      // at target
  powerUseW: number;
  batteryHours: number;   // hours the battery covers full load
  eclipseHours: number;   // hours in shadow per orbit (0 if none)
  dataMbDay: number;
  downlinkMbDay: number;
  scheduleDays: number;
  /** Plain words, ordered by severity. Empty when the design is launchable. */
  blockers: string[];
  warnings: string[];
}

/** Something the player may flag in the pre launch review. */
export interface ReviewItem {
  id: string;            // e.g. "part:antenna" or "process:deployTest"
  label: string;         // "High gain antenna (deployable)"
  slot?: SlotId;         // where to pin it on the 3D craft
  fix?: { label: string; costM: number; scheduleDays: number }; // what fixing it changes
}

export type FailureAnim =
  | 'antenna_jam' | 'panel_stuck' | 'wheel_fail' | 'tumble' | 'battery_drain'
  | 'engine_cutoff' | 'signal_lost' | 'valve_stick' | 'overheat' | 'crash' | 'none';

export interface FlightEvent {
  day: number;
  phase: 'launch' | 'cruise' | 'arrival' | 'operations' | 'end';
  kind: 'nominal' | 'failure' | 'crisis' | 'save';
  text: string;
  lessonId?: string;
  anim?: FailureAnim;
}

export interface CrisisOption {
  id: string;
  label: string;
  available: boolean;
  why?: string; // why it's unavailable, in plain words (tied to the player's margins)
}

export interface Crisis {
  lessonId: string;
  day: number;
  prompt: string;
  options: CrisisOption[];
}

export interface FlightRun {
  seed: number;
  design: Design;
  events: FlightEvent[];      // events so far
  pendingCrisis?: Crisis;     // flight pauses here until resolveCrisis
  done: boolean;
  result?: FlightResult;
}

export interface FlightResult {
  outcome: 'success' | 'degraded' | 'lost';
  sciencePct: number;          // 0..100 of the design's max science
  triggered: string[];         // lesson ids that hit this flight
  caught: string[];            // lesson ids that would have triggered and whose review item the player flagged
  prevented: string[];         // caught AND fixed, so the failure never happened
  missed: string[];            // would have triggered, not flagged
  falseFlags: string[];        // flagged review items that carried no real risk
}

export interface Lesson {
  id: string;
  mission: string;
  agency: string;
  year: number;
  subsystem: string;
  phase: string;
  what_happened: string;
  root_cause: string;
  outcome: string;
  what_nasa_did: string;
  lesson: string;
  design_trigger: string;
  llis_id: string | null;
  sources: { title: string; url: string }[];
}

/** A real crisis on a real spacecraft, played first (the cold open). */
export interface ColdOpen {
  id: string;
  lessonId: string;
  craft: string;        // nssdca key
  dateLabel: string;    // "October 2016, at Jupiter"
  setup: string[];      // 2 to 4 short telemetry lines
  prompt: string;
  options: { id: string; label: string; consequence: string }[];
  nasaChoice: string;   // option id NASA picked
  nasaWhy: string;
  sources: { title: string; url: string }[];
}

/** Per player memory of lessons (the lesson sky). Stored in localStorage by the UI. */
export interface LessonState {
  status: 'unseen' | 'hit' | 'caught';
  hits: number;
  catches: number;
  lastSeen?: string; // ISO date
}

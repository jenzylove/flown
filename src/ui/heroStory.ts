// The landing hero plays one real flight twice. Everything it shows is found here, at load time,
// by the same engine the game runs: a Jupiter design with the unfolding dish and no deployment test,
// a seed where the Galileo failure strikes, and the same seed flown again with the antenna pinned and fixed.
import {
  REFERENCE_DESIGNS, PROCESS_OPTIONS, REVIEW_FIXES,
  applyFixes, briefById, lessonById, partById, resolveCrisis, startFlight, wouldTrigger,
} from './eng';
import type { Design, FlightEvent, FlightRun } from './eng';

export const STORY_LESSON = 'galileo-hga-stuck-ribs';
export const STORY_ITEM = 'part:antenna';

export interface HeroStory {
  design: Design;
  seed: number;
  /** Days of schedule the skipped full deployment test would have cost. */
  skipDays: number;
  skipLabel: string;
  fullTestLabel: string;
  dishName: string;
  briefTitle: string;
  missionName: string;
  year: number;
  fix: { label: string; costM: number; scheduleDays: number };
  /** The unfixed flight, up to the moment the dish jams. */
  failEvents: FlightEvent[];
  crisisDay: number;
  /** The same seed, flown with the antenna pinned and fixed. */
  fixEvents: FlightEvent[];
  sciencePct: number;
  caught: boolean;
}

function flyOut(run: FlightRun) {
  let r = run;
  while (!r.done && r.pendingCrisis) r = resolveCrisis(r, r.pendingCrisis.options.find((o) => o.available)!.id);
  return r;
}

export function findHeroStory(): HeroStory | null {
  const ref = REFERENCE_DESIGNS.jupiter;
  const design: Design = {
    ...ref,
    parts: { ...ref.parts, antenna: 'hga_deployable' },
    process: { ...ref.process, deployTest: 'dt_none' },
  };
  // Prefer a seed where the dish is the only thing that goes wrong, so the story reads clean.
  let seed = -1;
  let fallback = -1;
  for (let s = 0; s < 500; s++) {
    const hits = wouldTrigger(design, s).map((r) => r.lessonId);
    if (!hits.includes(STORY_LESSON)) continue;
    if (fallback < 0) fallback = s;
    if (hits.length === 1) {
      seed = s;
      break;
    }
  }
  if (seed < 0) seed = fallback;
  if (seed < 0) return null;

  const fail = startFlight(design, seed, [], []);
  const strike = fail.events.findIndex((e) => e.lessonId === STORY_LESSON && e.kind !== 'save');
  if (strike < 0) return null;

  const fixed = flyOut(startFlight(applyFixes(design, [STORY_ITEM]), seed, [STORY_ITEM], [STORY_ITEM]));
  const res = fixed.result;
  if (!res || !res.prevented.includes(STORY_LESSON)) return null;

  const full = PROCESS_OPTIONS.find((o) => o.id === 'dt_full')!;
  const none = PROCESS_OPTIONS.find((o) => o.id === 'dt_none')!;
  const lesson = lessonById(STORY_LESSON)!;
  return {
    design,
    seed,
    skipDays: full.scheduleDays - none.scheduleDays,
    skipLabel: none.label,
    fullTestLabel: full.label,
    dishName: partById('hga_deployable')?.name ?? 'Unfolding dish',
    briefTitle: briefById(design.briefId).title,
    missionName: lesson.mission,
    year: lesson.year,
    fix: REVIEW_FIXES[STORY_ITEM]!,
    failEvents: fail.events.slice(0, strike + 1),
    crisisDay: fail.events[strike].day,
    fixEvents: fixed.events,
    sciencePct: res.sciencePct,
    caught: res.caught.includes(STORY_LESSON),
  };
}

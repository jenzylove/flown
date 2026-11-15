import { describe, expect, it } from 'vitest';
import { BRIEFS } from '../catalog';
import { crewScore, defaultDesign, evaluate, nasaChoice, resolveCrisis, startFlight } from '../index';
import type { Design } from '../types';

/** Fly a design on many seeds, answering every crisis the way the real team did. */
function fly(d: Design, pins: string[] = [], fixes: string[] = [], seeds = 400) {
  let sci = 0, crew = 0, lost = 0;
  for (let s = 1; s <= seeds; s++) {
    let run = startFlight({ ...d, fixes }, s, pins, fixes);
    for (let i = 0; run.pendingCrisis && i < 10; i++) {
      const c = run.pendingCrisis;
      const pick = nasaChoice(c.lessonId)?.optionId;
      const opt = c.options.find(o => o.id === pick && o.available) ?? c.options.find(o => o.available)!;
      run = resolveCrisis(run, opt.id);
    }
    const r = run.result!;
    sci += r.sciencePct; crew += crewScore(r); if (r.outcome === 'lost') lost++;
  }
  return { sci: sci / seeds, crew: crew / seeds, lost: lost / seeds };
}

describe('the score rewards the engineering the game teaches', () => {
  it('every starting design can launch', () => {
    for (const b of BRIEFS) expect(evaluate(defaultDesign(b.id)).blockers).toEqual([]);
  });

  it('a richer payload returns more science than a single cheap instrument', () => {
    const d = defaultDesign('jupiter');
    const one = fly({ ...d, instruments: ['magnetometer'] });
    const full = fly(d);
    expect(d.instruments.length).toBeGreaterThan(1);
    expect(full.sci).toBeGreaterThan(one.sci + 10);
  });

  it('adding an instrument never lowers science before failures', () => {
    const d = defaultDesign('mars-orbit');
    const base = fly({ ...d, instruments: ['magnetometer'] }, [], [], 50);
    const more = fly({ ...d, instruments: ['magnetometer', 'camera'] }, [], [], 50);
    expect(more.sci).toBeGreaterThanOrEqual(base.sci);
  });

  it('a lander battery that cannot last the night costs science', () => {
    const d = defaultDesign('mars-land');
    const small = fly({ ...d, parts: { ...d.parts, battery: 'battery_s' } });
    const large = fly({ ...d, parts: { ...d.parts, battery: 'battery_l' } });
    expect(large.sci).toBeGreaterThan(small.sci + 10);
  });

  it('testing in the hangar beats skipping the test and buying the fix at review', () => {
    for (const id of ['mars-orbit', 'mars-land']) {
      const d = defaultDesign(id);
      const tested = { ...d, process: { ...d.process, faultSim: 'fs_full' } };
      const skipped = { ...d, process: { ...d.process, faultSim: 'fs_none' } };
      const a = evaluate(tested), z = evaluate({ ...skipped, fixes: ['process:faultSim'] });
      // the late fix costs more money and more days than doing the test up front
      expect(z.costM).toBeGreaterThan(a.costM);
      expect(z.scheduleDays).toBeGreaterThan(a.scheduleDays);
    }
  });
});

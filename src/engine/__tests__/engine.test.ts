import { describe, expect, it } from 'vitest';
import {
  BRIEFS, LESSONS, RULES, REFERENCE_DESIGNS, calibration, catchRate, defaultDesign, evaluate,
  lessonById, resolveCrisis, reviewItems, startFlight, wouldTrigger, applyFixes, COLD_OPENS, dailyBrief,
} from '../index';

describe('data', () => {
  it('every rule points to a sourced lesson', () => {
    for (const r of RULES) {
      const l = lessonById(r.lessonId);
      expect(l, r.lessonId).toBeTruthy();
      expect(l!.sources.length).toBeGreaterThan(0);
    }
  });
  it('every lesson has at least one source url', () => {
    for (const l of LESSONS) expect(l.sources.every(s => /^https?:\/\//.test(s.url))).toBe(true);
  });
  it('cold open lesson exists', () => { expect(lessonById(COLD_OPENS[0].lessonId)).toBeTruthy(); });
});

describe('design', () => {
  it('every default design is launchable', () => {
    for (const b of BRIEFS) expect(evaluate(defaultDesign(b.id)).blockers, b.id).toEqual([]);
  });
  it('every reference design is launchable', () => {
    for (const b of BRIEFS) expect(evaluate(REFERENCE_DESIGNS[b.id]).blockers, b.id).toEqual([]);
  });
  it('blocks a solar craft at Pluto', () => {
    const d = defaultDesign('pluto'); d.parts.power = 'panel_large';
    expect(evaluate(d).blockers.join(' ')).toMatch(/power/i);
  });
  it('fixes cost money and time', () => {
    const d = defaultDesign('jupiter');
    const a = evaluate(d), b = evaluate(applyFixes(d, ['part:propulsion']));
    expect(b.costM).toBeGreaterThan(a.costM); expect(b.scheduleDays).toBeGreaterThan(a.scheduleDays);
  });
  it('review covers every slot and process', () => {
    expect(reviewItems(defaultDesign('jupiter')).length).toBe(12);
  });
});

describe('flight', () => {
  it('is deterministic for a seed', () => {
    const d = defaultDesign('mars-orbit');
    expect(JSON.stringify(startFlight(d, 7, [], []).events)).toBe(JSON.stringify(startFlight(d, 7, [], []).events));
  });
  it('a flagged and fixed risk is caught and prevented on the same seed', () => {
    const d = defaultDesign('jupiter'); d.parts.antenna = 'hga_deployable'; d.process.deployTest = 'dt_none';
    let seed = 0; while (!wouldTrigger(d, seed).some(r => r.lessonId === 'galileo-hga-stuck-ribs')) seed++;
    const first = startFlight(d, seed, [], []);
    const runs = [first]; let r = first;
    while (!r.done) { r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id); runs.push(r); }
    expect(r.result!.missed).toContain('galileo-hga-stuck-ribs');
    let r2 = startFlight(d, seed, ['part:antenna'], ['part:antenna']);
    while (!r2.done) r2 = resolveCrisis(r2, r2.pendingCrisis!.options.find(o => o.available)!.id);
    expect(r2.result!.caught).toContain('galileo-hga-stuck-ribs');
    expect(r2.result!.prevented).toContain('galileo-hga-stuck-ribs');
    expect(r2.events.some(e => e.kind === 'save')).toBe(true);
  });
  it('firing on Juno valves is a seeded gamble, never certain loss', () => {
    const d = defaultDesign('jupiter');
    let seed = 0; while (!wouldTrigger(d, seed).some(r => r.lessonId === 'juno-helium-check-valves')) seed++;
    let r = startFlight(d, seed, [], []);
    while (!r.done && r.pendingCrisis?.lessonId !== 'juno-helium-check-valves') r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id);
    if (!r.done) { r = resolveCrisis(r, 'burn'); expect(r.events.some(e => /NASA feared|not worth taking/.test(e.text))).toBe(true); }
  });
  it('unavailable crisis options explain why', () => {
    const d = defaultDesign('planets'); d.parts.attitude = 'wheels_3'; d.parts.power = 'panel_small';
    let seed = 0; while (!wouldTrigger(d, seed).some(r => r.lessonId === 'kepler-reaction-wheels')) seed++;
    let r = startFlight(d, seed, [], []);
    while (!r.done && r.pendingCrisis?.lessonId !== 'kepler-reaction-wheels') r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id);
    const sun = r.pendingCrisis?.options.find(o => o.id === 'sunlight');
    if (sun) { expect(sun.available).toBe(false); expect(sun.why).toBeTruthy(); }
  });
  it('catch rate', () => {
    expect(catchRate([{ caught: ['a'], missed: ['b', 'c'] }])).toBeCloseTo(1 / 3);
    expect(catchRate([])).toBeNull();
  });
  it('daily brief is stable for a date', () => {
    const a = dailyBrief(new Date('2026-11-14T10:00:00Z')), b = dailyBrief(new Date('2026-11-14T20:00:00Z'));
    expect(a.brief.id).toBe(b.brief.id); expect(a.seed).toBe(b.seed);
  });
});

describe('calibration', () => {
  it('prints', () => { console.table(calibration()); });
});

import { encodeShare, decodeShare, crewScore } from '../index';
describe('share', () => {
  it('round trips', () => {
    const d = defaultDesign('pluto'); const code = encodeShare(d, 4242);
    const back = decodeShare(code)!; expect(back.seed).toBe(4242); expect(back.design.parts).toEqual(d.parts);
    expect(back.design.instruments).toEqual(d.instruments); expect(back.design.process).toEqual(d.process);
  });
  it('rejects junk', () => { expect(decodeShare('x.y')).toBeNull(); expect(decodeShare(encodeShare(defaultDesign('pluto'), 1).replace('rtg', 'wheels_3'))).toBeNull(); });
  it('crew score rewards catches', () => {
    expect(crewScore({ sciencePct: 50, caught: ['a'], missed: [], falseFlags: [] })).toBe(65);
    expect(crewScore({ sciencePct: 50, caught: ['a'], missed: [], falseFlags: ['x', 'y'] })).toBe(55);
  });
});

describe('review limits', () => {
  it('caps pins and counts wrong pins against the catch rate', () => {
    const d = defaultDesign('jupiter');
    let r = startFlight(d, 3, ['part:power','part:battery','part:antenna','part:attitude','part:propulsion','part:computer'], []);
    while (!r.done) r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id);
    expect(r.result!.caught.length + r.result!.falseFlags.length).toBeLessThanOrEqual(4);
    expect(catchRate([{ caught: ['a'], missed: [], falseFlags: ['b', 'c', 'd'] }])).toBeCloseTo(0.25);
  });
  it('rocket and orbit change the budget', () => {
    const d = defaultDesign('mars-orbit');
    const heavy = evaluate({ ...d, launch: 'lv_heavy' }), std = evaluate(d);
    expect(heavy.massLimitKg).toBeGreaterThan(std.massLimitKg); expect(heavy.costM).toBeGreaterThan(std.costM);
    expect(evaluate({ ...d, orbit: 'orb_close' }).eclipseHours).toBeGreaterThan(evaluate({ ...d, orbit: 'orb_wide' }).eclipseHours);
  });
  it('downlink shortfall is explained', () => {
    const d = defaultDesign('jupiter'); d.instruments = ['camera', 'radar'];
    let r = startFlight(d, 999, [], []);
    while (!r.done) r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id);
    expect(r.result!.notes.join(' ')).toMatch(/never reached Earth/);
  });
});

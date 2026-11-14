import { describe, expect, it } from 'vitest';
import { BRIEFS, RULES, defaultDesign, startFlight, resolveCrisis, wouldTrigger, PARTS, PROCESS_OPTIONS, SLOTS, INSTRUMENTS } from '../index';
import type { Design } from '../types';

// The answer key: for every real failure in play, find a design and seed where it strikes,
// then prove that pinning and fixing the right review item prevents it on the same seed.
function variants(): Design[] {
  const out: Design[] = [];
  for (const b of BRIEFS) {
    const base = defaultDesign(b.id);
    out.push(base);
    for (const s of SLOTS) for (const p of PARTS.filter(x => x.slot === s)) out.push({ ...base, parts: { ...base.parts, [s]: p.id } });
    for (const o of PROCESS_OPTIONS) out.push({ ...base, process: { ...base.process, [o.process]: o.id } });
    for (const i of INSTRUMENTS) out.push({ ...base, instruments: [i.id] });
  }
  return out;
}
const fly = (d: Design, seed: number, pins: string[]) => {
  let r = startFlight(d, seed, pins, pins);
  while (!r.done) r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id);
  return r;
};

describe('answer key', () => {
  const V = variants();
  for (const rule of RULES) {
    it(`${rule.lessonId}: strikes on a matching design and is prevented by fixing ${rule.item}`, () => {
      let found: { d: Design; seed: number } | null = null;
      outer: for (const d of V) for (let seed = 0; seed < 300; seed++) {
        if (wouldTrigger(d, seed).some(r => r.lessonId === rule.lessonId)) { found = { d, seed }; break outer; }
      }
      expect(found, 'no design triggers it').toBeTruthy();
      const { d, seed } = found!;
      const unpinned = fly(d, seed, []);
      expect(unpinned.result!.missed).toContain(rule.lessonId);
      const fixed = fly(d, seed, [rule.item]);
      expect(fixed.result!.caught).toContain(rule.lessonId);
      expect(fixed.result!.prevented).toContain(rule.lessonId);
      if (fixed.result!.outcome !== 'lost') expect(fixed.events.some(e => e.kind === 'save' && e.lessonId === rule.lessonId)).toBe(true);
    });
  }
});

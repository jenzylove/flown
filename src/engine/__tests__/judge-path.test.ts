import { expect, it } from 'vitest';
import { defaultDesign, wouldTrigger, startFlight, resolveCrisis } from '../index';
it('the judge path (Jupiter, seed 2, dish, no deployment test) always hits Galileo and nothing else, and the fix holds', () => {
  const d = defaultDesign('jupiter');
  expect(wouldTrigger(d, 2)).toEqual([]);
  const dish = { ...d, parts: { ...d.parts, antenna: 'hga_deployable' }, process: { ...d.process, deployTest: 'dt_none' } };
  expect(wouldTrigger(dish, 2).map(r => r.lessonId)).toEqual(['galileo-hga-stuck-ribs']);
  let r = startFlight(dish, 2, ['part:antenna'], ['part:antenna']);
  while (!r.done) r = resolveCrisis(r, r.pendingCrisis!.options.find(o => o.available)!.id);
  expect(r.result!.prevented).toContain('galileo-hga-stuck-ribs');
});

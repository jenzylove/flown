import { describe, it, expect } from 'vitest';
import { rolesFor, pinsFor, ownerOfGroup, ownerOfItem, ownerOfLesson, ROLES } from '../coop';
import { RULES, SLOTS } from '../eng';

describe('one craft roles', () => {
  it('covers every hangar group exactly once', () => {
    const groups = ROLES.flatMap((r) => r.groups).sort();
    expect(groups).toEqual([...SLOTS, 'instruments', 'process', 'launch', 'orbit'].sort());
  });
  for (const n of [2, 3, 4]) {
    it(`splits all four roles and four pins across ${n} players`, () => {
      expect(rolesFor(n)).toHaveLength(n);
      expect(rolesFor(n).flat().sort()).toEqual(['comms', 'lead', 'power', 'prop']);
      expect(pinsFor(n)).toHaveLength(n);
      expect(pinsFor(n).reduce((a, b) => a + b, 0)).toBe(4);
    });
  }
  it('gives the lead two pins with three players', () => expect(pinsFor(3)[0]).toBe(2));
  it('routes subsystems to their owners', () => {
    expect(ownerOfGroup(4, 'attitude')).toBe(3);
    expect(ownerOfItem(4, 'process:faultSim')).toBe(0);
    expect(ownerOfItem(2, 'part:antenna')).toBe(1);
    expect(ownerOfLesson(4, 'kepler-reaction-wheels')).toBe(3);
    for (const r of RULES) expect(ownerOfLesson(3, r.lessonId)).toBeLessThan(3);
  });
});

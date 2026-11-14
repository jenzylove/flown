import { partById, instrumentById, SLOTS } from './eng';
import type { Design, PartLook, SlotId, Instrument } from './eng';

export function looksOf(design: Design): Partial<Record<SlotId, PartLook>> {
  const out: Partial<Record<SlotId, PartLook>> = {};
  for (const s of SLOTS) {
    const p = partById(design.parts[s]);
    if (p) out[s] = p.look;
  }
  return out;
}

export function instrumentLooks(design: Design): Instrument['look'][] {
  return design.instruments
    .map((id) => instrumentById(id)?.look)
    .filter((x): x is Instrument['look'] => !!x);
}

export const SLOT_NAME: Record<SlotId, string> = {
  power: 'Power',
  battery: 'Battery',
  antenna: 'Antenna',
  attitude: 'Pointing',
  propulsion: 'Engine',
  computer: 'Computer',
  thermal: 'Thermal',
};

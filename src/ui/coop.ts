// One craft crew mode: roles split the hangar, the pins and the crisis calls.
// Pure helpers only. Every number still comes from the engine.
import { RULES, SLOTS } from './eng';
import type { SlotId } from './eng';

export type RoleId = 'lead' | 'power' | 'comms' | 'prop';
/** A hangar tab: a slot, or one of the mission level choices. */
export type Group = SlotId | 'instruments' | 'process' | 'launch' | 'orbit';

export interface Role {
  id: RoleId;
  name: string;
  short: string;
  groups: Group[];
}

export const ROLES: Role[] = [
  { id: 'lead', name: 'Mission lead', short: 'Lead', groups: ['orbit', 'launch', 'process'] },
  { id: 'power', name: 'Power and thermal', short: 'Power', groups: ['power', 'battery', 'thermal'] },
  { id: 'comms', name: 'Comms and science', short: 'Comms', groups: ['antenna', 'computer', 'instruments'] },
  { id: 'prop', name: 'Propulsion and pointing', short: 'Propulsion', groups: ['propulsion', 'attitude'] },
];

export const roleById = (id: RoleId) => ROLES.find((r) => r.id === id)!;

/** Which roles each player holds, by crew size. Fewer players merge roles; the lead always sits with player one. */
export function rolesFor(n: number): RoleId[][] {
  if (n <= 2) return [['lead', 'prop'], ['power', 'comms']];
  if (n === 3) return [['lead', 'prop'], ['power'], ['comms']];
  return [['lead'], ['power'], ['comms'], ['prop']];
}

/** Review pins per player: four in all. */
export function pinsFor(n: number): number[] {
  if (n <= 2) return [2, 2];
  if (n === 3) return [2, 1, 1];
  return [1, 1, 1, 1];
}

export function roleNames(ids: RoleId[]) {
  return ids.map((id) => roleById(id).name).join(' + ');
}

export function ownerOfGroup(n: number, g: Group): number {
  const roles = rolesFor(n);
  const i = roles.findIndex((rs) => rs.some((r) => roleById(r).groups.includes(g)));
  return i < 0 ? 0 : i;
}

/** The hangar group behind a review item id ("part:antenna", "process:faultSim"). */
export function groupOfItem(item: string): Group {
  if (item.startsWith('process:')) return 'process';
  const s = item.slice('part:'.length);
  if (s === 'instruments' || (SLOTS as string[]).includes(s)) return s as Group;
  return 'process';
}

export const ownerOfItem = (n: number, item: string) => ownerOfGroup(n, groupOfItem(item));

/** The review item a real failure belongs to (from the engine's rules). */
export function itemOfLesson(lessonId: string): string | undefined {
  return RULES.find((r) => r.lessonId === lessonId)?.item;
}

/** The player who owns the subsystem a lesson strikes. */
export function ownerOfLesson(n: number, lessonId: string): number {
  const item = itemOfLesson(lessonId);
  return item ? ownerOfItem(n, item) : 0;
}

/** The role, among a player's roles, that owns a group. */
export function roleOfGroup(n: number, g: Group): Role {
  const roles = rolesFor(n)[ownerOfGroup(n, g)];
  return roleById(roles.find((r) => roleById(r).groups.includes(g)) ?? roles[0]);
}

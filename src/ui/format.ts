export const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
export const n1 = (v: number) =>
  Math.abs(v) >= 100 ? n0(v) : (Math.round(v * 10) / 10).toLocaleString('en-US');
export const kg = (v: number) => `${n0(v)} kg`;
export const usd = (v: number) => `$${n1(v)}M`;
export const watts = (v: number) => `${n0(v)} W`;
export const hours = (v: number) => `${n1(v)} h`;
export const days = (v: number) => `${n0(v)} ${Math.round(v) === 1 ? 'day' : 'days'}`;
export const mb = (v: number) => (v >= 1000 ? `${n1(v / 1000)} Gb` : `${n0(v)} Mb`);
export const pct = (v: number) => `${Math.round(v)}%`;
export const two = (i: number) => String(i).padStart(2, '0');

/** Stable 32 bit hash of a string (FNV 1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function isoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function dayDiff(a: string, b: string) {
  const ta = Date.parse(a + 'T00:00:00');
  const tb = Date.parse(b + 'T00:00:00');
  return Math.round((tb - ta) / 86400000);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2011-08-05" to "5 August 2011" (no dashes in visible copy). */
export function prettyDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

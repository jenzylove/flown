import { encodeShare, decodeShare, startFlight, resolveCrisis, reviewItems, evaluate, applyFixes, wouldTrigger } from './eng';
import type { Design, FlightResult, BudgetReport } from './eng';
import type { Mission } from './store';

/** Pins, fixes and crisis picks ride along after the code, so the friend's flight can be replayed by the engine. */
export function shareMeta(m: Pick<Mission, 'flagged' | 'fixed' | 'choices'>): string {
  const q = new URLSearchParams();
  q.set('r', '1');
  if (m.flagged.length) q.set('p', m.flagged.join(','));
  if (m.fixed.length) q.set('f', m.fixed.join(','));
  if (m.choices?.length) q.set('c', m.choices.join(','));
  return q.toString();
}

export function sharePath(m: Mission): string {
  const meta = shareMeta(m);
  return '/fly/' + encodeShare({ ...m.design, fixes: [] }, m.seed) + (meta ? '?' + meta : '');
}

export function shareUrl(m: Mission): string {
  const { origin, pathname } = window.location;
  return origin + pathname + '#' + sharePath(m);
}

export interface Friend {
  design: Design;
  seed: number;
  flagged: string[];
  fixed: string[];
  /** Budget report with the friend's fixes charged. */
  report: BudgetReport;
  /** The friend's flight replayed by the engine, or null when the link did not carry it. */
  result: FlightResult | null;
  /** Real failures that come for this design on this seed, before any pins or fixes. */
  incoming: string[];
}

/** Split "#/fly/<code>?<meta>" (without the "/fly/" prefix) into its two halves. */
export function splitShare(rest: string): { code: string; meta: string } {
  const i = rest.indexOf('?');
  return i < 0 ? { code: rest, meta: '' } : { code: rest.slice(0, i), meta: rest.slice(i + 1) };
}

export function readFriend(code: string, meta: string): Friend | null {
  let dec: ReturnType<typeof decodeShare> = null;
  try {
    dec = decodeShare(decodeURIComponent(code));
  } catch {
    dec = null;
  }
  if (!dec) return null;
  const design = { ...dec.design, fixes: [] };
  const q = new URLSearchParams(meta);
  const valid = new Set(reviewItems(design).map((i) => i.id));
  const list = (k: string) => (q.get(k) ?? '').split(',').filter(Boolean);
  const flagged = list('p').filter((x) => valid.has(x));
  const fixed = list('f').filter((x) => flagged.includes(x));
  const choices = list('c');
  const hasFlight = q.has('p') || q.has('f') || q.has('c') || q.has('r');
  let result: FlightResult | null = null;
  if (hasFlight) {
    try {
      let run = startFlight(design, dec.seed, flagged, fixed);
      for (const c of choices) {
        if (!run.pendingCrisis) break;
        const next = resolveCrisis(run, c);
        if (next === run) break;
        run = next;
      }
      result = run.done && run.result ? run.result : null;
    } catch {
      result = null;
    }
  }
  return {
    design,
    seed: dec.seed,
    flagged,
    fixed,
    report: evaluate(applyFixes(design, fixed)),
    result,
    incoming: wouldTrigger(design, dec.seed).map((r) => r.lessonId),
  };
}

/** Copy text; resolves false when the clipboard is blocked so the caller can show a field instead. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

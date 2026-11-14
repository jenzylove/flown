import { useEffect, useRef, useState } from 'react';

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Types telemetry lines in one after another. */
export function Typed({ lines, speed = 16, onDone, skip }: { lines: string[]; speed?: number; onDone?: () => void; skip?: boolean }) {
  const total = lines.reduce((a, l) => a + l.length, 0);
  const [n, setN] = useState(() => (reduce() ? total : 0));
  const doneRef = useRef(false);
  useEffect(() => {
    if (skip) setN(total);
  }, [skip, total]);
  useEffect(() => {
    if (n >= total) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }
    const id = window.setTimeout(() => setN((x) => Math.min(total, x + 2)), speed);
    return () => window.clearTimeout(id);
  }, [n, total, speed, onDone]);

  let left = n;
  return (
    <ol className="telemetry">
      {lines.map((l, i) => {
        const shown = Math.max(0, Math.min(l.length, left));
        left -= l.length;
        const active = shown > 0 && shown < l.length;
        if (shown === 0 && i > 0) return <li key={i} className="tl-wait" aria-hidden="true" />;
        return (
          <li key={i} className={active ? 'tl-active' : ''}>
            <span className="tl-no">{String(i + 1).padStart(2, '0')}</span>
            <span className="tl-text">
              {l.slice(0, shown)}
              {active && <i className="caret" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

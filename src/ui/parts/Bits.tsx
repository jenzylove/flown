import type { ReactNode } from 'react';

/** Small line icons drawn in code, 24 unit grid, stroke only. */
const ICON: Record<string, ReactNode> = {
  power: (
    <>
      <rect x="2.5" y="8" width="7" height="8" />
      <rect x="14.5" y="8" width="7" height="8" />
      <path d="M9.5 12h5M5.5 8v8M18.5 8v8M2.5 12h7M14.5 12h7" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="7" width="16" height="10" />
      <path d="M19 10.5h2v3h-2M6.5 10v4M9.5 10v4M12.5 10v4" />
    </>
  ),
  antenna: (
    <>
      <path d="M4 9a10 6 0 0 0 16 0" />
      <path d="M4 9h16M12 12.2V20M8.5 20h7M12 9l3-5" />
    </>
  ),
  attitude: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <ellipse cx="12" cy="12" rx="7.5" ry="3" />
      <path d="M12 2v3M12 19v3" />
    </>
  ),
  propulsion: (
    <>
      <rect x="8" y="3" width="8" height="6" />
      <path d="M9.5 9 6.5 17h11l-3-8M9 20l-.5 1.5M12 20v2M15 20l.5 1.5" />
    </>
  ),
  computer: (
    <>
      <rect x="6" y="6" width="12" height="12" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </>
  ),
  thermal: (
    <>
      <path d="M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z" />
      <path d="M12 9v7M17 6h3M17 9.5h2" />
    </>
  ),
  instruments: (
    <>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" />
      <path d="M3 12c2.5-4.5 5.5-6.5 9-6.5s6.5 2 9 6.5c-2.5 4.5-5.5 6.5-9 6.5S5.5 16.5 3 12z" />
    </>
  ),
  process: (
    <>
      <rect x="5" y="4" width="14" height="17" />
      <path d="M8 9l1.5 1.5L12 8M8 14l1.5 1.5L12 13M14 9.5h2.5M14 14.5h2.5M9.5 4V2.5h5V4" />
    </>
  ),
  launch: (
    <>
      <path d="M12 2.5c2.6 2.4 3.5 5.6 3.5 9v6h-7v-6c0-3.4.9-6.6 3.5-9z" />
      <path d="M8.5 13.5 6 16v4l2.5-2.5M15.5 13.5 18 16v4l-2.5-2.5M10.5 20.5h3" />
      <circle cx="12" cy="9" r="1.4" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-20 12 12)" />
      <circle cx="20.6" cy="8.6" r="1.3" />
    </>
  ),
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {ICON[name] ?? <circle cx="12" cy="12" r="6" />}
    </svg>
  );
}

/** A small drawing of where each brief goes. */
export function TargetGlyph({ id }: { id: string }) {
  const g: Record<string, ReactNode> = {
    jupiter: (
      <>
        <circle cx="40" cy="40" r="24" />
        <path d="M17.5 32h45M16.5 40h47M17.5 48h45" />
        <ellipse cx="48" cy="44" rx="5" ry="2.6" className="fill-soft" />
        <ellipse cx="40" cy="40" rx="35" ry="9" transform="rotate(-24 40 40)" className="dash" />
      </>
    ),
    'mars-orbit': (
      <>
        <circle cx="40" cy="40" r="20" />
        <circle cx="33" cy="34" r="3" />
        <circle cx="46" cy="45" r="4.5" />
        <circle cx="37" cy="48" r="1.8" />
        <ellipse cx="40" cy="40" rx="31" ry="31" className="dash" />
        <circle cx="64" cy="20" r="2.6" className="fill" />
      </>
    ),
    planets: (
      <>
        <circle cx="40" cy="40" r="7" />
        <path d="M40 22v-6M40 58v6M22 40h-6M58 40h6M27 27l-4-4M53 53l4 4M53 27l4-4M27 53l-4 4" />
        <circle cx="62" cy="62" r="2.4" className="fill" />
        <circle cx="16" cy="66" r="1.4" className="fill" />
        <circle cx="66" cy="16" r="1.4" className="fill" />
        <circle cx="40" cy="40" r="28" className="dash" />
      </>
    ),
    pluto: (
      <>
        <circle cx="34" cy="44" r="16" />
        <path d="M30 48c-3-3-1-7 2-6 1-3 6-2 5 2 0 3-4 5-7 4z" className="fill-soft" />
        <circle cx="61" cy="24" r="6" />
        <path d="M6 70 72 8" className="dash" />
      </>
    ),
    mercury: (
      <>
        <path d="M2 4a40 40 0 0 1 0 72" />
        <path d="M2 14a30 30 0 0 1 0 52" className="dash" />
        <circle cx="52" cy="40" r="12" />
        <circle cx="49" cy="36" r="2" />
        <circle cx="56" cy="44" r="2.6" />
        <ellipse cx="52" cy="40" rx="22" ry="8" transform="rotate(-18 52 40)" className="dash" />
      </>
    ),
    'mars-land': (
      <>
        <path d="M4 58c12-6 20 2 32-4s22-2 40-6" />
        <path d="M4 66h72" className="dash" />
        <rect x="32" y="30" width="16" height="10" />
        <path d="M32 40l-6 12M48 40l6 12M40 30v-8M36 20h8" />
        <circle cx="62" cy="16" r="4" />
      </>
    ),
  };
  return (
    <svg className="target-glyph" viewBox="0 0 80 80" aria-hidden="true">
      {g[id] ?? <circle cx="40" cy="40" r="20" />}
    </svg>
  );
}

/** Quiet disclosure: a short label that opens the details. Native details, so it works without script. */
export function More({
  label,
  count,
  open,
  tone,
  className,
  children,
}: {
  label: ReactNode;
  count?: number | string;
  open?: boolean;
  tone?: 'bad';
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={'more' + (tone === 'bad' ? ' more-bad' : '') + (className ? ' ' + className : '')} open={open}>
      <summary>
        <span className="more-label">{label}</span>
        {count !== undefined && <span className="more-count">{count}</span>}
        <svg className="more-chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 4.5 6 8.5 10 4.5" /></svg>
      </summary>
      <div className="more-body">{children}</div>
    </details>
  );
}

/** First sentence of a text, and whatever follows it. */
export function splitFirst(text: string): [string, string] {
  const m = /^(.+?[.!?])\s+(.+)$/s.exec(text.trim());
  return m ? [m[1], m[2]] : [text, ''];
}

import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { href } from './router';
import { applyTheme, effectiveTheme, loadTheme, useGame } from './store';
import type { CraftViewProps } from '../three/CraftView';

const CraftViewLazy = lazy(() => import('../three/CraftView'));

export function Craft3D(props: CraftViewProps) {
  return (
    <Suspense fallback={<div className={'craft-view craft-wait ' + (props.className ?? '')}><span>Drawing the craft</span></div>}>
      <CraftViewLazy {...props} />
    </Suspense>
  );
}

export function ThemeToggle() {
  const [t, setT] = useState<'light' | 'dark'>(() => effectiveTheme());
  useEffect(() => {
    const p = loadTheme();
    if (p) applyTheme(p);
    setT(effectiveTheme());
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => setT(effectiveTheme());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const next = t === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="theme-toggle"
      aria-label={`Switch to ${next === 'light' ? 'blueprint paper' : 'night board'} theme`}
      title={next === 'light' ? 'Blueprint paper' : 'Night board'}
      onClick={() => {
        applyTheme(next);
        setT(next);
      }}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M10 2.5 A7.5 7.5 0 0 1 10 17.5 Z" fill="currentColor" />
      </svg>
    </button>
  );
}

export function Shell({ route, children }: { route: string; children: ReactNode }) {
  const streak = useGame((s) => s.streak);
  const top = route.split('/')[1] || '';
  const flying = ['play', 'brief', 'hangar', 'review', 'flight', 'refly', 'crew', 'fly'].includes(top);
  const APP = ['juno', 'play', 'brief', 'hangar', 'refly', 'review', 'flight', 'case', 'sky', 'proof', 'crew', 'fly', 'lab'];
  if (!APP.includes(top.split('?')[0])) {
    // The landing page brings its own top bar and footer.
    return <div className="shell">{children}</div>;
  }
  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href={href('/')} aria-label="Flown home">
          <span className="wm-word">Flown</span>
          <span className="wm-tag">mission review board</span>
        </a>
        <nav className="topnav">
          <a href={href('/play')} className={flying ? 'on' : ''}>Fly</a>
          <a href={href('/sky')} className={top === 'sky' ? 'on' : ''}>
            Sky
            {streak.count > 0 && <em className="streak-dot">{streak.count}</em>}
          </a>
          <a href={href('/proof')} className={top === 'proof' ? 'on' : ''}>Proof</a>
          <ThemeToggle />
        </nav>
      </header>
      <main className="stage">{children}</main>
      <footer className="footer">
        <div className="footer-rule" aria-hidden="true" />
        <div className="footer-grid">
          <p className="footer-mark">Flown</p>
          <p>
            Spacecraft facts from the{' '}
            <a href="https://nssdc.gsfc.nasa.gov/nmc/" target="_blank" rel="noreferrer">NASA Space Science Data Coordinated Archive</a>.
            Lessons from the{' '}
            <a href="https://llis.nasa.gov/" target="_blank" rel="noreferrer">NASA Lessons Learned Information System</a>{' '}
            and the mission reports linked on each case file. Every source is listed on the{' '}
            <a href={href('/proof')}>proof page</a>.
          </p>
          <p className="footer-legal">Not a NASA product. Built for NASA Space Apps 2026.</p>
        </div>
      </footer>
    </div>
  );
}

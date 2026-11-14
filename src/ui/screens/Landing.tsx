import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import {
  LESSONS, PLAYABLE_LESSONS, BRIEFS, MAX_PINS, COLD_OPENS, REAL_CRAFT, REFERENCE_DESIGNS,
  calibration, dailyBrief, encodeShare, lessonById,
} from '../eng';
import type { SlotId, PartLook, Instrument } from '../eng';
import { Craft3D, ThemeToggle } from '../Shell';
import { CrisisDecision } from '../parts/CrisisDecision';
import { looksOf, instrumentLooks } from '../craftLooks';
import { useGame } from '../store';
import { go, href } from '../router';
import { kg, n0, prettyDate, two } from '../format';
import { layout, shortName } from './Sky';
import { findHeroStory } from '../heroStory';

const IG_URL = 'https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf';
const SWARTWOUT_URL = 'https://thespacereview.com/article/3047/1';
const REPO_URL = 'https://github.com/jenzylove/flown';
const ANSWER_KEY_URL = REPO_URL + '/blob/master/src/engine/__tests__/answer-key.test.ts';

/* ------------------------------------------------------------------ */
/* figures, all read from the engine and data                          */
/* ------------------------------------------------------------------ */

const SOURCE_COUNT = new Set(LESSONS.flatMap((l) => l.sources.map((s) => s.url))).size;
const SOURCED = LESSONS.filter((l) => l.sources.length > 0).length;

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ------------------------------------------------------------------ */
/* small hooks                                                         */
/* ------------------------------------------------------------------ */

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function useMedia(q: string) {
  const [on, setOn] = useState(() => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setOn(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return on;
}

/** True while the element is within `margin` of the viewport. */
function useInView(ref: RefObject<Element | null>, margin = '0px') {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/** In page link that scrolls without touching the hash router. */
function Jump({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href('/')}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        scrollToId(to);
      }}
    >
      {children}
    </a>
  );
}

function useFlyToday() {
  const startMission = useGame((s) => s.startMission);
  return () => {
    const t = dailyBrief(new Date());
    startMission(t.brief.id, t.seed, true);
    go('/hangar');
  };
}

/** A number that counts up once, the first time it is on screen. Reduced motion shows the end value. */
function Count({ to, format = n0 }: { to: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    setValue(0);
    let raf = 0;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / 1200);
          setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    seen.observe(node);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return <span ref={ref}>{format(value)}</span>;
}

/* ------------------------------------------------------------------ */
/* 00 hero: one real flight, played twice                              */
/* ------------------------------------------------------------------ */

const STORY = findHeroStory();

type Piece = SlotId | 'inst';
const HERO_ORDER: Piece[] = ['power', 'battery', 'attitude', 'propulsion', 'computer', 'thermal', 'inst', 'antenna'];
/** When each of the five steps starts, in ms. The story ends about six seconds in. */
const STORY_AT = [0, 1500, 2700, 4000, 5100] as const;
const LAST = STORY_AT.length - 1;

function partial(full: Partial<Record<SlotId, PartLook>>, inst: Instrument['look'][], n: number) {
  const looks: Partial<Record<SlotId, PartLook>> = {};
  let instruments: Instrument['look'][] = [];
  HERO_ORDER.slice(0, n).forEach((p) => {
    if (p === 'inst') instruments = inst;
    else looks[p] = full[p];
  });
  return { looks, instruments };
}

function useStory(ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  const [assembled, setAssembled] = useState(0);
  const [reopen, setReopen] = useState(false);
  const reduced = useMemo(reducedMotion, []);

  useEffect(() => {
    if (!ready) return;
    if (reduced) {
      setStep(LAST);
      setAssembled(HERO_ORDER.length);
      return;
    }
    setStep(-1);
    setAssembled(0);
    let timers: number[] = [];
    const play = () => {
      timers = STORY_AT.map((at, i) => window.setTimeout(() => setStep(i), at + 60));
      // parts snap on one by one during step one
      HERO_ORDER.forEach((_, i) => timers.push(window.setTimeout(() => setAssembled(i + 1), 120 + i * 150)));
      // step five: lift the dish off and put it back, so it unfolds again from closed
      timers.push(window.setTimeout(() => setReopen(true), STORY_AT[LAST] + 60));
      timers.push(window.setTimeout(() => setReopen(false), STORY_AT[LAST] + 160));
    };
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      play();
      return () => timers.forEach((t) => window.clearTimeout(t));
    }
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        play();
      },
      { threshold: 0.4 },
    );
    seen.observe(node);
    return () => {
      seen.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [run, ready, reduced]);

  return { ref, step, run, assembled, reopen, reduced, replay: () => setRun((n) => n + 1) };
}

type LogLine = { k: string; t: string; alarm?: boolean; good?: boolean };

/** The flight log lines printed by the end of each step, straight from the engine runs. */
function storyLog(): LogLine[][] {
  if (!STORY) return [[], [], [], [], []];
  const s = STORY;
  const save = s.fixEvents.find((e) => e.kind === 'save');
  const end = s.fixEvents[s.fixEvents.length - 1];
  return [
    [
      { k: 'BRIEF', t: s.briefTitle },
      { k: 'ANTENNA', t: s.dishName },
    ],
    [
      { k: 'TEST', t: s.skipLabel },
      { k: 'SAVED', t: `${n0(s.skipDays)} days` },
    ],
    [
      { k: 'SEED', t: String(s.seed) },
      ...s.failEvents.map((e) => ({
        k: `DAY ${n0(e.day)}`,
        t: e.text,
        alarm: e.kind === 'crisis' || e.kind === 'failure',
      })),
    ],
    [
      { k: 'PIN', t: 'Antenna', alarm: true },
      { k: 'FIX', t: s.fix.label },
      { k: 'COST', t: `$${n0(s.fix.costM)}M and ${n0(s.fix.scheduleDays)} days` },
    ],
    [
      { k: 'REFLY', t: `Same seed, ${s.seed}` },
      ...(save ? [{ k: `DAY ${n0(save.day)}`, t: save.text, good: true }] : []),
      ...(end ? [{ k: `DAY ${n0(end.day)}`, t: end.text }] : []),
      { k: 'SCIENCE', t: `${n0(s.sciencePct)}%`, good: true },
    ],
  ];
}

const LOG = storyLog();

function storyNotes(): ReactNode[] {
  if (!STORY) return ['', '', '', '', ''];
  const s = STORY;
  return [
    <>You build a {s.briefTitle.replace(/^Orbit /, '')} probe with an unfolding dish</>,
    <>You skip the deployment test to save {n0(s.skipDays)} days</>,
    <>Day {n0(s.crisisDay)}: the dish jams half open. {s.missionName}, {s.year}.</>,
    <>You pin the antenna and pay for the fix</>,
    <>Same flight again: the fix holds. Caught before launch.</>,
  ];
}
const NOTES = storyNotes();

function HeroStory() {
  const [mount, setMount] = useState(false);
  // Let the headline paint first, then fetch three.js.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setMount(true), { timeout: 900 });
    else window.setTimeout(() => setMount(true), 250);
  }, []);
  const { ref, step, run, assembled, reopen, reduced, replay } = useStory(mount);
  const visible = useInView(ref, '120px');
  const narrow = useMedia('(max-width: 600px)');
  const logRef = useRef<HTMLOListElement>(null);

  const full = useMemo(() => (STORY ? looksOf(STORY.design) : {}), []);
  const inst = useMemo(() => (STORY ? instrumentLooks(STORY.design) : []), []);
  const n = step < 0 ? 0 : step === 0 ? assembled : HERO_ORDER.length;
  const built = partial(full, inst, n);
  const looks = step === LAST && reopen ? { ...built.looks, antenna: undefined } : built.looks;
  const jammed = step === 2 || step === 3;
  const pins = step === 3 ? [{ slot: 'antenna' as SlotId, label: STORY ? `Pinned: fix for $${n0(STORY.fix.costM)}M` : 'Pinned' }] : [];
  const lines = step < 0 ? [] : LOG.slice(0, step + 1).flat();

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  if (!STORY) return null;
  const done = step >= LAST;
  return (
    <div className="lp-story">
      <p className={'lp-story-note' + (step === 2 ? ' alarm' : '')} aria-live="polite">
        <span className="lp-story-no">{two(Math.max(1, step + 1))}/{two(STORY_AT.length)}</span>
        <span key={step + ':' + run} className="lp-story-text">{NOTES[Math.max(0, step)]}</span>
        <button type="button" className={'lp-replay' + (done && !reduced ? ' on' : '')} onClick={replay} disabled={!done || reduced} aria-hidden={!done || reduced}>
          Replay
        </button>
      </p>
      <figure className={'lp-hero-fig' + (jammed ? ' is-jam' : '') + (done ? ' is-done' : '')} ref={ref}>
        <div className="lp-hero-canvas">
          {mount && (
            <Craft3D
              className="lp-craft"
              looks={looks}
              instruments={built.instruments}
              anim={jammed ? 'antenna_jam' : 'none'}
              animKey={'jam' + run}
              highlight={step === 1 ? 'antenna' : null}
              autoRotate={!reduced}
              paused={!visible}
              distance={narrow ? 6.8 : 8.8}
              pins={pins}
              beam={done}
            />
          )}
          <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
          <div className={'lp-star' + (done ? ' on' : '')} aria-hidden={!done}>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="16" className="lp-star-halo" />
              <path d="M20 6 V34 M6 20 H34" className="lp-star-spike" />
              <circle cx="20" cy="20" r="4.4" className="lp-star-core" />
            </svg>
            <span>
              <b>{STORY.missionName} {STORY.year}</b>
              New bright star in your sky
            </span>
          </div>
        </div>
        <figcaption className="lp-log" aria-label="Flight log from the engine run">
          <p className="lp-log-head">
            <span>Flight log</span>
            <span>{STORY.briefTitle} &middot; seed {STORY.seed}</span>
          </p>
          <ol ref={logRef}>
            {lines.map((l, i) => (
              <li key={i + ':' + run} className={(l.alarm ? 'alarm' : '') + (l.good ? ' good' : '')}>
                <span className="lp-log-k">{l.k}</span>
                <span className="lp-log-t">{l.t}</span>
              </li>
            ))}
            {step < LAST && <li className="lp-log-cursor" aria-hidden="true"><span className="lp-log-k" /><span className="lp-log-t">&#9608;</span></li>}
          </ol>
        </figcaption>
      </figure>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 how it works                                                     */
/* ------------------------------------------------------------------ */

const STEPS: { t: string; p: ReactNode }[] = [
  {
    t: 'Build to a real brief',
    p: <>Pick one of {BRIEFS.length} missions modeled on real ones. Snap on power, antenna, engine and instruments inside a real budget.</>,
  },
  {
    t: 'Pin what worries you',
    p: <>At the review you get {MAX_PINS} pins. Put them on what you think will fail and pay to fix it. A pin on nothing counts against you.</>,
  },
  {
    t: 'Fly into real failures',
    p: <>{PLAYABLE_LESSONS.length} failures that really happened can strike in flight. In a crisis you get the choices the real team had.</>,
  },
  {
    t: 'Read the case, fly again',
    p: <>Every failure opens its real case file. Change the design, refly the same seed, and prove the lesson stuck.</>,
  },
];

function StepGlyph({ i }: { i: number }) {
  return (
    <svg className={'lp-glyph g' + i} viewBox="0 0 120 80" aria-hidden="true">
      {i === 0 && (
        <g>
          <rect x="48" y="28" width="24" height="24" />
          <rect x="10" y="34" width="30" height="12" className="dash" />
          <rect x="80" y="34" width="30" height="12" />
          <path d="M60 28 V14 M50 10 Q60 2 70 10" />
          <path d="M40 40 H48 M72 40 H80" />
        </g>
      )}
      {i === 1 && (
        <g>
          <rect x="44" y="30" width="32" height="26" />
          <circle cx="40" cy="22" r="4" className="alarm-fill" />
          <path d="M40 26 V34" className="alarm-stroke" />
          <circle cx="82" cy="18" r="4" className="alarm-fill" />
          <path d="M82 22 V32" className="alarm-stroke" />
          <path d="M86 18 H104" className="alarm-stroke" />
        </g>
      )}
      {i === 2 && (
        <g>
          <rect x="48" y="30" width="24" height="24" />
          <path d="M72 42 H104" />
          <path d="M48 42 L32 30 L20 44" className="alarm-stroke" />
          <path d="M14 22 L24 30 M18 52 L26 46" className="alarm-stroke" />
        </g>
      )}
      {i === 3 && (
        <g>
          <rect x="36" y="14" width="48" height="56" />
          <path d="M44 28 H76 M44 38 H76 M44 48 H64" />
          <path d="M60 58 L66 64 L80 50" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 03 a real crisis                                                    */
/* ------------------------------------------------------------------ */

function Crisis() {
  const co = COLD_OPENS[0];
  const craft = REAL_CRAFT[co.craft];
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, '-25% 0px -25% 0px');
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (inView) setStarted(true);
  }, [inView]);
  return (
    <div className="lp-crisis" ref={box}>
      <div className="lp-crisis-main">
        <p className="eyebrow"><span className="eyebrow-dot" /> {co.dateLabel}</p>
        <h3 className="lp-crisis-title">
          {craft?.name ?? 'Juno'} <em>has a valve problem.</em>
        </h3>
        <CrisisDecision co={co} start={started} buildLabel="Build your own mission" />
      </div>
      {craft && (
        <aside className="lp-crisis-facts" aria-label="Spacecraft facts from NASA NSSDCA">
          <p className="mono-label">The real craft &middot; NSSDCA</p>
          <dl className="lp-facts">
            <div><dt>Craft</dt><dd>{craft.name}</dd></div>
            {craft.mass_kg != null && <div><dt>Listed mass</dt><dd>{kg(craft.mass_kg)}</dd></div>}
            {craft.launch_vehicle && <div><dt>Rocket</dt><dd>{craft.launch_vehicle}</dd></div>}
            {craft.launch_date && <div><dt>Launched</dt><dd>{prettyDate(craft.launch_date)}</dd></div>}
          </dl>
          <a className="cite" href={craft.source} target="_blank" rel="noreferrer">NSSDCA record</a>
        </aside>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 lesson wall                                                      */
/* ------------------------------------------------------------------ */

function firstSentence(s: string) {
  const m = /^(.+?[.!?])(\s|$)/.exec(s);
  return m ? m[1] : s;
}

function WallItem({ id, hidden }: { id: string; hidden?: boolean }) {
  const l = lessonById(id)!;
  return (
    <li aria-hidden={hidden || undefined}>
      <a className="lp-wall-item" href={href('/case/' + l.id)} tabIndex={hidden ? -1 : undefined}>
        <span className="lp-wall-meta">
          {l.outcome === 'lost' && <i className="lp-lost" title="Mission lost" />}
          {l.year}
          {l.llis_id && <> &middot; LLIS {l.llis_id}</>}
          {!l.llis_id && <> &middot; {l.sources.length} {l.sources.length === 1 ? 'source' : 'sources'}</>}
        </span>
        <span className="lp-wall-name">{l.mission}</span>
        <span className="lp-wall-what">{firstSentence(l.what_happened)}</span>
      </a>
    </li>
  );
}

function Wall() {
  const ids = useMemo(() => LESSONS.map((l) => l.id), []);
  return (
    <div className="lp-wall">
      <div className="lp-wall-row" style={{ ['--drift' as string]: `${ids.length * 6}s` }}>
        <ul className="lp-wall-track">
          {ids.map((id) => <WallItem key={id} id={id} />)}
          {ids.map((id) => <WallItem key={id + ':b'} id={id} hidden />)}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 lesson sky preview                                               */
/* ------------------------------------------------------------------ */

const EXAMPLE_BRIGHT = ['galileo-hga-stuck-ribs', 'mars-climate-orbiter-units', 'kepler-reaction-wheels', 'lucy-solar-array-latch'];
const EXAMPLE_RED = ['juno-helium-check-valves', 'mars-polar-lander-leg-signal'];

function SkyPreview() {
  const narrow = useMedia('(max-width: 600px)');
  const W = narrow ? 600 : 1000;
  const H = narrow ? 700 : 560;
  const stars = useMemo(() => layout(W, H), [W, H]);
  return (
    <figure className="lp-sky">
      <svg className="sky lp-sky-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="An example lesson sky with a few bright and red stars">
        <defs>
          <radialGradient id="lp-halo">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="sky-reticle">
          <circle cx={W / 2} cy={H / 2} r={H * 0.42} />
          <circle cx={W / 2} cy={H / 2} r={H * 0.27} />
          <line x1={W / 2} y1={10} x2={W / 2} y2={H - 10} />
          <line x1={10} y1={H / 2} x2={W - 10} y2={H / 2} />
        </g>
        {stars.map((s) => {
          const st = EXAMPLE_BRIGHT.includes(s.id) ? 'caught' : EXAMPLE_RED.includes(s.id) ? 'hit' : 'unseen';
          const playable = PLAYABLE_LESSONS.includes(s.id);
          return (
            <g key={s.id} className={`star st-${st}${playable ? '' : ' lib'}`} style={{ ['--tw' as string]: `${s.tw * 3}s` }}>
              {st === 'caught' && <circle cx={s.x} cy={s.y} r={20} fill="url(#lp-halo)" className="star-halo" />}
              {st === 'caught' && <path className="star-spike" d={`M${s.x - 12} ${s.y}H${s.x + 12}M${s.x} ${s.y - 12}V${s.y + 12}`} />}
              <circle cx={s.x} cy={s.y} r={st === 'caught' ? 4.4 : st === 'hit' ? 3.8 : playable ? 2.4 : 1.6} className="star-core" />
              {st !== 'unseen' && (
                <text x={s.x > W / 2 ? s.x - 10 : s.x + 10} y={s.y - 10} textAnchor={s.x > W / 2 ? 'end' : 'start'} className="star-label lp-star-label">
                  {shortName(s.mission)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="lp-sky-key">
        <span className="lp-example">Example sky, not yours</span>
        <span><i className="k k-bright" /> Bright: caught before launch</span>
        <span><i className="k k-red" /> Red: hit your craft</span>
        <span><i className="k k-faint" /> Faint: not met yet</span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* the page                                                            */
/* ------------------------------------------------------------------ */

function Sec({ id, no, title, kicker, children, className }: { id: string; no: string; title: ReactNode; kicker?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={'lp-sec ' + (className ?? '')} aria-labelledby={id + '-h'}>
      <header className="lp-sec-head" data-reveal>
        <span className="lp-sec-no">{no}</span>
        {kicker && <span className="lp-sec-kicker">{kicker}</span>}
        <h2 id={id + '-h'}>{title}</h2>
      </header>
      {children}
    </section>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Is it free?', a: 'Yes. Flown is free to play in your browser. There is nothing to buy and nothing to install.' },
  {
    q: 'Do I need an account?',
    a: (
      <>
        No. There is no sign up. Your lesson sky, streak and best flights are saved in this browser on this device only. Read the{' '}
        <a href={href('/privacy')}>privacy note</a>.
      </>
    ),
  },
  {
    q: 'Are the failures real?',
    a: (
      <>
        Yes. All {LESSONS.length} are things that really happened to real spacecraft and rockets, each with public sources such as NASA&rsquo;s Lessons Learned
        Information System and mishap board reports. Every case file links them.
      </>
    ),
  },
  {
    q: 'Are the numbers real?',
    a: (
      <>
        Some are. Spacecraft facts come from NASA&rsquo;s NSSDCA catalog and mission budgets are close to the real ones. Part values, failure chances and
        dry mass limits are simplified so the game plays well. The <a href={href('/proof')}>proof page</a> checks them against real craft and shows every error.
      </>
    ),
  },
  {
    q: 'Is this a NASA product?',
    a: (
      <>
        No. Flown was built for NASA Space Apps 2026, for the Space Mission Design Game challenge. It is not made or endorsed by NASA, and no NASA logos
        are used. <a href={href('/about')}>About Flown</a>.
      </>
    ),
  },
  {
    q: 'How do I play with friends?',
    a: (
      <>
        Start a <a href={href('/crew')}>crew</a> for 2 to 4 players and pass one device around, or finish a flight and send the challenge link. Your
        friend flies the same seed with the same failures.
      </>
    ),
  },
  { q: 'Does it work on a phone?', a: 'Yes. Flown runs in any modern browser on a phone, tablet or computer. The 3D craft is drawn live, and you can rotate it with a finger.' },
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const flyToday = useFlyToday();
  const streak = useGame((s) => s.streak);
  const today = useMemo(() => dailyBrief(new Date()), []);
  const medErr = useMemo(() => {
    const errs = calibration().filter((c) => c.errPct !== null).map((c) => Math.abs(c.errPct!));
    return { med: median(errs), n: errs.length };
  }, []);
  const sampleChallenge = useMemo(() => '/fly/' + encodeShare(REFERENCE_DESIGNS.jupiter, 4242), []);

  // reveal on scroll, once
  useEffect(() => {
    const els = root.current?.querySelectorAll('[data-reveal]') ?? [];
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // parallax layer over the engineering grid
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = (window.scrollY * 0.18) % 240;
        if (grid.current) grid.current.style.transform = `translate3d(0, ${-y}px, 0)`;
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp" ref={root}>
      <div className="lp-grid" ref={grid} aria-hidden="true" />

      <header className="topbar lp-top">
        <a className="wordmark" href={href('/')} aria-label="Flown home" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); }}>
          <span className="wm-word">Flown</span>
          <span className="wm-tag">mission review board</span>
        </a>
        <nav className="topnav lp-nav" aria-label="Page">
          <Jump to="how" className="lp-nav-link">How it works</Jump>
          <Jump to="failures" className="lp-nav-link">Real failures</Jump>
          <Jump to="proof" className="lp-nav-link">Proof</Jump>
          <Jump to="sky" className="lp-nav-link">Lesson Sky</Jump>
          <ThemeToggle />
          <a className="btn btn-primary btn-small lp-play" href={href('/play')}>Play free</a>
        </nav>
      </header>

      {/* 00 hero */}
      <section className="lp-hero" aria-labelledby="hero-h">
        <div className="lp-hero-copy">
          <p className="eyebrow lp-rise" style={{ ['--d' as string]: '0ms' }}>
            <span className="lp-sec-no">00</span> A free browser game &middot; Built for NASA Space Apps 2026
          </p>
          <h1 id="hero-h" className="lp-h1 lp-rise" style={{ ['--d' as string]: '60ms' }}>
            Design a space mission. <em>Survive real mission failures.</em>
          </h1>
          <p className="lp-sub lp-rise" style={{ ['--d' as string]: '140ms' }}>
            {PLAYABLE_LESSONS.length} failures from real missions can strike your craft in flight. Build to one of {BRIEFS.length} real briefs, pin
            the risks you see before launch and pay to fix them. Every failure links to its public record.
          </p>
          <div className="cta-row lp-rise" style={{ ['--d' as string]: '220ms' }}>
            <a className="btn btn-primary lp-btn-big" href={href('/play')}>Play free, no sign up</a>
            <Jump to="how" className="btn btn-ghost lp-btn-big">How it works</Jump>
          </div>
          <p className="lp-quiet lp-rise" style={{ ['--d' as string]: '280ms' }}>
            Or try <Jump to="crisis">Juno&rsquo;s real call</Jump> <span aria-hidden="true">&middot;</span>{' '}
            <button type="button" onClick={flyToday}>Fly today&rsquo;s mission</button>
          </p>
        </div>
        <HeroStory />
      </section>

      {/* 01 stakes */}
      <section id="problem" className="lp-sec lp-stakes" aria-labelledby="problem-h">
        <p className="lp-stakes-k" data-reveal><span className="lp-sec-no">01</span> The problem</p>
        <h2 id="problem-h" className="lp-stakes-t" data-reveal>
          NASA keeps a lesson for every failure. Only <span className="alarm">57%</span> of its own flight project managers used them.
        </h2>
        <a className="cite lp-stakes-cite" href={IG_URL} target="_blank" rel="noreferrer" data-reveal>NASA OIG report IG 12 012, 2012</a>
        <p className="lp-stakes-2" data-reveal>
          And <span className="alarm">30%</span> of university class small satellites that reached orbit were dead on arrival.{' '}
          <a className="cite" href={SWARTWOUT_URL} target="_blank" rel="noreferrer">Swartwout study of 244 smallsats, The Space Review</a>
        </p>
      </section>

      {/* 02 how it works */}
      <Sec id="how" no="02" kicker="How it works" title={<>Four steps. <em>One loop that teaches.</em></>}>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} className="lp-step" data-reveal style={{ ['--d' as string]: `${i * 90}ms` }}>
              <span className="lp-step-no">{two(i + 1)}</span>
              <StepGlyph i={i} />
              <h3>{s.t}</h3>
              <p>{s.p}</p>
            </li>
          ))}
        </ol>
      </Sec>

      {/* 03 crisis */}
      <Sec id="crisis" no="03" kicker="Try a real crisis" title={<>One real decision. <em>Make the call.</em></>}>
        <div data-reveal>
          <Crisis />
        </div>
      </Sec>

      {/* 04 wall */}
      <Sec
        id="failures"
        no="04"
        kicker="Every failure is real"
        title={<>{LESSONS.length} real failures. <em>Not one made up.</em></>}
        className="lp-sec-wide"
      >
        <div data-reveal>
          <Wall />
        </div>
        <p className="lp-wall-cta" data-reveal>
          <a className="lp-arrow" href={href('/proof')}>See all {LESSONS.length} with their sources</a>
          <span>{PLAYABLE_LESSONS.length} can strike in play. The rest are library reading in your sky.</span>
        </p>
      </Sec>

      {/* 05 loop */}
      <Sec id="sky" no="05" kicker="The loop that teaches" title={<>Your skill is <em>what you catch before launch.</em></>}>
        <div className="lp-loop">
          <div data-reveal>
            <SkyPreview />
          </div>
          <dl className="lp-rules" data-reveal>
            <div>
              <dt>Caught before launch rate</dt>
              <dd>
                <span className="lp-formula">
                  <span>caught</span>
                  <i />
                  <span>caught + missed + wrong pins</span>
                </span>
                A failure you pinned at the review is caught. One you missed counts against you.
              </dd>
            </div>
            <div>
              <dt>{MAX_PINS} pins, and wrong pins cost you</dt>
              <dd>You cannot pin everything, and a pin on something with no real risk lowers your rate. Choose like a real review board.</dd>
            </div>
            <div>
              <dt>Mission of the Day</dt>
              <dd>
                One shared brief and seed for everyone, every day. Today: <b>{today.brief.title}</b>.
                {streak.count > 0 ? <> Your streak: <b>{streak.count} {streak.count === 1 ? 'day' : 'days'}</b>.</> : <> Fly daily to build a streak.</>}
                <span className="lp-inline-ctas">
                  <button className="btn btn-primary btn-small" onClick={flyToday}>Fly today&rsquo;s mission</button>
                  <a className="btn btn-ghost btn-small" href={href('/sky')}>Open your sky</a>
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </Sec>

      {/* 06 together */}
      <Sec id="together" no="06" kicker="Play together" title={<>Same failures. <em>Different calls.</em></>}>
        <div className="lp-together">
          <div className="lp-mode" data-reveal>
            <p className="lp-mode-k">Crew mode &middot; 2 to 4 players &middot; one device</p>
            <p className="lp-mode-t">One craft. Every role has a say.</p>
            <p>
              Split the craft by role: mission lead, power and thermal, comms and science, propulsion and pointing. Each player owns their systems and their
              review pins, and the craft launches only when everyone calls GO. Prefer a contest? Race mode gives each player their own craft on the same seed.
            </p>
            <ol className="lp-roster" aria-label="How a one craft crew plays">
              <li className="done"><span>01</span>Build your systems</li>
              <li className="now"><span>02</span>Everyone calls GO</li>
              <li><span>03</span>Team board</li>
            </ol>
            <a className="btn btn-primary" href={href('/crew')}>Form a crew</a>
          </div>
          <div className="lp-mode" data-reveal style={{ ['--d' as string]: '120ms' }}>
            <p className="lp-mode-k">Challenge a friend &middot; one link</p>
            <p className="lp-mode-t">Send one link. Beat their score.</p>
            <p>
              After any flight, copy the challenge link. Your friend flies your craft on the same seed against the same failures, and the scores sit side
              by side.
            </p>
            <code className="lp-link" title="A sample challenge link">#{sampleChallenge}</code>
            <a className="btn btn-ghost" href={href(sampleChallenge)}>Open a sample challenge</a>
          </div>
        </div>
      </Sec>

      {/* 07 measured */}
      <Sec id="proof" no="07" kicker="Proof" title={<>Measured, <em>not guessed.</em></>}>
        <ul className="lp-measured" aria-label="Flown, measured">
          <li data-reveal>
            <span className="lp-m-n"><Count to={PLAYABLE_LESSONS.length} /><small>/{PLAYABLE_LESSONS.length}</small></span>
            <span className="lp-m-l">real failures in play, each proven to strike a matching design and to be stopped by its fix on the same seed</span>
            <a className="cite" href={ANSWER_KEY_URL} target="_blank" rel="noreferrer">The answer key test</a>
          </li>
          <li data-reveal style={{ ['--d' as string]: '100ms' }}>
            <span className="lp-m-n"><Count to={SOURCED} /><small>/{LESSONS.length}</small></span>
            <span className="lp-m-l">lessons with public sources, {n0(SOURCE_COUNT)} links in all, from mishap boards and NASA&rsquo;s lessons database</span>
            <a className="cite" href={href('/proof')}>Every source, listed</a>
          </li>
          {medErr.med !== null && (
            <li data-reveal style={{ ['--d' as string]: '200ms' }}>
              <span className="lp-m-n"><Count to={medErr.med} /><small>%</small></span>
              <span className="lp-m-l">median mass error against {medErr.n} real craft in NASA NSSDCA, every miss published</span>
              <a className="cite" href={href('/proof')}>The sizing check</a>
            </li>
          )}
        </ul>
        <div className="lp-truth" data-reveal>
          <p><b>Real:</b> the failures and their sources, the crisis choices and the call NASA made, spacecraft facts from NSSDCA, mission budgets.</p>
          <p><b>Simplified for play:</b> part values, how often a failure strikes, and the dry mass limit for each rocket.</p>
          <a className="btn btn-ghost" href={href('/proof')}>See the tests and sources</a>
        </div>
      </Sec>

      {/* 08 faq */}
      <Sec id="faq" no="08" kicker="Questions" title={<>Plain answers.</>}>
        <div className="lp-faq" data-reveal>
          {FAQ.map((f, i) => (
            <details key={f.q} className="lp-qa">
              <summary>
                <span className="lp-qa-no">{two(i + 1)}</span>
                <span className="lp-qa-q">{f.q}</span>
                <span className="lp-qa-x" aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </Sec>

      {/* closing */}
      <section className="lp-close" aria-label="Start playing">
        <p className="lp-close-k" data-reveal>Ready for review</p>
        <p className="lp-close-t" data-reveal>
          Every failure here happened once. <em>Catch it before it happens to you.</em>
        </p>
        <div className="cta-row lp-close-ctas" data-reveal>
          <a className="btn btn-primary lp-btn-big" href={href('/play')}>Play free, no sign up</a>
          <button className="btn btn-ghost lp-btn-big" onClick={flyToday}>Mission of the Day</button>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-top">
          <div className="lp-foot-brand">
            <p className="lp-foot-mark">Flown</p>
            <p>A free browser game where you design a space mission and survive real mission failures, most of them from NASA&rsquo;s own records.</p>
          </div>
          <nav className="lp-foot-cols" aria-label="Footer">
            <div>
              <p className="mono-label">Play</p>
              <a href={href('/play')}>Play free</a>
              <button onClick={flyToday}>Mission of the Day</button>
              <a href={href('/crew')}>Crew mode</a>
              <a href={href('/sky')}>Lesson Sky</a>
            </div>
            <div>
              <p className="mono-label">Learn</p>
              <Jump to="how">How it works</Jump>
              <Jump to="failures">Real failures</Jump>
              <a href={href('/proof')}>Proof and sources</a>
              <a href={href('/juno')}>The Juno decision</a>
            </div>
            <div>
              <p className="mono-label">Data</p>
              <a href="https://nssdc.gsfc.nasa.gov/nmc/" target="_blank" rel="noreferrer">NASA NSSDCA</a>
              <a href="https://llis.nasa.gov/" target="_blank" rel="noreferrer">NASA LLIS</a>
              <a href={IG_URL} target="_blank" rel="noreferrer">NASA OIG report</a>
            </div>
            <div>
              <p className="mono-label">About</p>
              <a href={href('/about')}>About Flown</a>
              <a href={href('/privacy')}>Privacy</a>
              <a href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer">NASA Space Apps 2026</a>
              <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub repo</a>
              <a href={REPO_URL + '/blob/master/LICENSE'} target="_blank" rel="noreferrer">MIT license</a>
            </div>
          </nav>
        </div>
        <div className="lp-foot-legal">
          <p>&copy; 2026 Flown. Free to play.</p>
          <p>Not a NASA product. No NASA logos are used.</p>
        </div>
        <p className="lp-foot-word" aria-hidden="true">Flown</p>
      </footer>
    </div>
  );
}

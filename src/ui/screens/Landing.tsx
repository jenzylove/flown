import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import {
  LESSONS, PLAYABLE_LESSONS, BRIEFS, MAX_PINS, COLD_OPENS, REAL_CRAFT, REFERENCE_DESIGNS,
  calibration, dailyBrief, encodeShare, lessonById, partById,
} from '../eng';
import type { Design, SlotId, PartLook, Instrument } from '../eng';
import { Craft3D, ThemeToggle } from '../Shell';
import { CrisisDecision } from '../parts/CrisisDecision';
import { looksOf, instrumentLooks, SLOT_NAME } from '../craftLooks';
import { useGame } from '../store';
import { go, href } from '../router';
import { kg, n0, prettyDate, two } from '../format';
import { layout, shortName } from './Sky';

const IG_URL = 'https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf';
const SWARTWOUT_URL = 'https://thespacereview.com/article/3047/1';
const REPO_URL = 'https://github.com/jenzylove/flown';

/* ------------------------------------------------------------------ */
/* figures, all read from the engine and data                          */
/* ------------------------------------------------------------------ */

const SOURCE_COUNT = new Set(LESSONS.flatMap((l) => l.sources.map((s) => s.url))).size;
const FIGURES = [
  { n: LESSONS.length, label: 'real failures, all sourced' },
  { n: PLAYABLE_LESSONS.length, label: 'can strike in play' },
  { n: BRIEFS.length, label: 'missions on real craft' },
  { n: SOURCE_COUNT, label: 'public sources linked' },
];

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

/* ------------------------------------------------------------------ */
/* craft designs used on this page                                     */
/* ------------------------------------------------------------------ */

const HERO_DESIGN: Design = {
  ...REFERENCE_DESIGNS.jupiter,
  parts: { ...REFERENCE_DESIGNS.jupiter.parts, antenna: 'hga_deployable' },
};
const STEP_DESIGN: Design = {
  ...REFERENCE_DESIGNS['mars-orbit'],
  parts: { ...REFERENCE_DESIGNS['mars-orbit'].parts, power: 'panel_wings', antenna: 'hga_fixed' },
};
type Piece = SlotId | 'inst';
const HERO_ORDER: Piece[] = ['power', 'battery', 'attitude', 'propulsion', 'computer', 'thermal', 'inst', 'antenna'];
const STEP_ORDER: Piece[] = ['power', 'antenna', 'battery', 'attitude', 'propulsion', 'computer', 'thermal', 'inst'];

function partial(full: Partial<Record<SlotId, PartLook>>, inst: Instrument['look'][], order: Piece[], n: number) {
  const looks: Partial<Record<SlotId, PartLook>> = {};
  let instruments: Instrument['look'][] = [];
  order.slice(0, n).forEach((p) => {
    if (p === 'inst') instruments = inst;
    else looks[p] = full[p];
  });
  return { looks, instruments };
}

/** Counts up to `max`, one step every `ms`, restarting whenever `runKey` changes. */
function useAssembly(max: number, ms: number, runKey: unknown, instant: boolean) {
  const [n, setN] = useState(instant ? max : 0);
  useEffect(() => {
    if (instant) {
      setN(max);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= max) window.clearInterval(id);
    }, ms);
    return () => window.clearInterval(id);
  }, [max, ms, runKey, instant]);
  return n;
}

/* ------------------------------------------------------------------ */
/* 00 hero craft                                                       */
/* ------------------------------------------------------------------ */

const GALILEO = lessonById('galileo-hga-stuck-ribs');

function HeroCraft() {
  const fig = useRef<HTMLElement>(null);
  const visible = useInView(fig, '120px');
  const reduced = useMemo(reducedMotion, []);
  const narrow = useMedia('(max-width: 600px)');
  const [mount, setMount] = useState(false);
  // Let the headline paint first, then fetch three.js.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => setMount(true), { timeout: 900 });
    } else {
      window.setTimeout(() => setMount(true), 250);
    }
  }, []);

  const full = useMemo(() => looksOf(HERO_DESIGN), []);
  const inst = useMemo(() => instrumentLooks(HERO_DESIGN), []);
  const n = useAssembly(HERO_ORDER.length, 520, mount, reduced);
  const built = n >= HERO_ORDER.length;
  const [jam, setJam] = useState(0);
  useEffect(() => {
    if (!built || !mount) return;
    if (reduced) {
      setJam(1);
      return;
    }
    const first = window.setTimeout(() => setJam(1), 1600);
    const loop = window.setInterval(() => setJam((j) => j + 1), 9000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
    };
  }, [built, mount, reduced]);

  const { looks, instruments } = partial(full, inst, HERO_ORDER, n);
  const fitting = HERO_ORDER[Math.min(n, HERO_ORDER.length - 1)];
  const label = built
    ? jam > 0 ? 'Failure replay' : 'Craft complete'
    : `Fitting ${fitting === 'inst' ? 'instruments' : SLOT_NAME[fitting].toLowerCase()}`;

  return (
    <figure className="lp-hero-fig" ref={fig}>
      <div className="lp-hero-canvas">
        {mount && (
          <Craft3D
            className="lp-craft"
            looks={looks}
            instruments={instruments}
            anim={jam > 0 ? 'antenna_jam' : 'none'}
            animKey={jam}
            autoRotate={!reduced}
            paused={!visible}
            distance={narrow ? 6.4 : 9.6}
            pins={jam > 0 && GALILEO ? [{ slot: 'antenna', label: `${GALILEO.mission} ${GALILEO.year}` }] : []}
          />
        )}
      </div>
      <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
      <span className={'lp-fig-label' + (jam > 0 ? ' alarm' : '')}>
        {label} &middot; {two(Math.min(n, HERO_ORDER.length))}/{two(HERO_ORDER.length)}
      </span>
      {GALILEO && (
        <figcaption className={'lp-jam-callout' + (jam > 0 ? ' on' : '')}>
          <svg className="lp-leader" viewBox="0 0 60 30" aria-hidden="true"><path d="M0 29 L22 2 L60 2" /></svg>
          <span>
            <b>{GALILEO.mission}, {GALILEO.year}.</b> The umbrella dish jammed half open. Every failure in Flown happened like this one.{' '}
            <a href={href('/case/' + GALILEO.id)}>Read the case</a>
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* 02 how it works                                                     */
/* ------------------------------------------------------------------ */

const LUCY = lessonById('lucy-solar-array-latch');
const FIXED_PANELS = partById('panel_large');

const STEPS: { t: string; p: ReactNode; cap: string; alarm?: boolean }[] = [
  {
    t: 'Build to a real brief',
    p: (
      <>
        Pick one of {BRIEFS.length} missions modeled on real ones, from a Mars orbiter to a Pluto flyby. Snap on power, antenna, engine, computer and
        instruments inside a budget close to the real one and a dry mass limit for your rocket.
      </>
    ),
    cap: 'Parts snap on, one by one',
  },
  {
    t: 'Pin what worries you',
    p: (
      <>
        Before launch you hold a review. You get {MAX_PINS} pins. Put them on the parts and choices you think will fail, and pay to fix the ones you
        believe in. Pin something that carries no real risk and it counts against you.
      </>
    ),
    cap: 'Orange pins mark the risks you see',
    alarm: true,
  },
  {
    t: 'Fly into real failures',
    p: (
      <>
        {PLAYABLE_LESSONS.length} failures that really happened can strike your craft in flight. Each one plays out on your model, and in a crisis you
        get the same choices the real team had.
      </>
    ),
    cap: LUCY ? `Real failure: ${LUCY.mission}, ${LUCY.year}. A solar wing did not latch.` : 'A real failure strikes',
    alarm: true,
  },
  {
    t: 'Read the case, fix it, fly again',
    p: (
      <>
        Every failure opens the real case file: what happened, why, and what NASA did. Change the design, refly the same seed, and prove the lesson stuck.
      </>
    ),
    cap: FIXED_PANELS ? `The fix holds. ${FIXED_PANELS.name}: ${FIXED_PANELS.blurb}` : 'The fix holds',
  },
];

function StepCraft({ step, visible }: { step: number; visible: boolean }) {
  const reduced = useMemo(reducedMotion, []);
  const design = useMemo<Design>(
    () => (step >= 3 ? { ...STEP_DESIGN, parts: { ...STEP_DESIGN.parts, power: 'panel_large' } } : STEP_DESIGN),
    [step],
  );
  const full = useMemo(() => looksOf(design), [design]);
  const inst = useMemo(() => instrumentLooks(design), [design]);
  const n = useAssembly(STEP_ORDER.length, 380, step === 0 ? `a${visible}` : 'built', reduced || step > 0);
  const { looks, instruments } = partial(full, inst, STEP_ORDER, step === 0 ? n : STEP_ORDER.length);
  const pins =
    step === 1
      ? [
          { slot: 'power' as SlotId, label: 'Wing latch' },
          { slot: 'attitude' as SlotId, label: 'Wheels' },
          { slot: 'propulsion' as SlotId, label: 'Fuel margin' },
        ]
      : step === 2 && LUCY
        ? [{ slot: 'power' as SlotId, label: `${LUCY.mission} ${LUCY.year}` }]
        : [];
  return (
    <Craft3D
      className="lp-craft"
      looks={looks}
      instruments={instruments}
      anim={step === 2 ? 'panel_stuck' : 'none'}
      animKey={step}
      pins={pins}
      autoRotate={!reduced}
      paused={!visible}
      distance={8.2}
    />
  );
}

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

function HowItWorks() {
  const [step, setStep] = useState(0);
  const wide = useMedia('(min-width: 1001px)');
  const frame = useRef<HTMLDivElement>(null);
  const visible = useInView(frame, '200px');
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (visible) setSeen(true);
  }, [visible]);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp-how">
      {wide && (
        <div className="lp-how-stage" ref={frame}>
          <div className="lp-how-frame">
            {seen && <StepCraft step={step} visible={visible} />}
            <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
            <ol className="lp-how-ticks" aria-hidden="true">
              {STEPS.map((s, i) => (
                <li key={s.t} className={i === step ? 'on' : i < step ? 'past' : ''}>{two(i + 1)}</li>
              ))}
            </ol>
            <p key={step} className={'lp-how-cap' + (STEPS[step].alarm ? ' alarm' : '')}>{STEPS[step].cap}</p>
          </div>
        </div>
      )}
      <ol className="lp-steps">
        {STEPS.map((s, i) => (
          <li
            key={s.t}
            data-step={i}
            ref={(el) => {
              items.current[i] = el;
            }}
            className={'lp-step' + (i === step ? ' on' : '')}
          >
            <span className="lp-step-no">{two(i + 1)}</span>
            {!wide && <StepGlyph i={i} />}
            <h3>{s.t}</h3>
            <p>{s.p}</p>
            {!wide && <p className={'lp-step-cap' + (s.alarm ? ' alarm' : '')}>{s.cap}</p>}
          </li>
        ))}
      </ol>
    </div>
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
  const rows = useMemo(() => {
    const a = LESSONS.filter((_, i) => i % 2 === 0).map((l) => l.id);
    const b = LESSONS.filter((_, i) => i % 2 === 1).map((l) => l.id);
    return [a, b];
  }, []);
  return (
    <div className="lp-wall">
      {rows.map((ids, r) => (
        <div key={r} className={'lp-wall-row r' + r}>
          <ul className="lp-wall-track">
            {ids.map((id) => <WallItem key={id} id={id} />)}
            {ids.map((id) => <WallItem key={id + ':b'} id={id} hidden />)}
          </ul>
        </div>
      ))}
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
  const H = narrow ? 760 : 620;
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
  { q: 'Do I need an account?', a: 'No. There is no sign up. Your lesson sky, streak and best flights are saved in this browser on this device only.' },
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
  { q: 'Is this a NASA product?', a: 'No. Flown was built for NASA Space Apps 2026, for the Space Mission Design Game challenge. It is not made or endorsed by NASA, and no NASA logos are used.' },
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
  {
    q: 'Where does the data come from?',
    a: (
      <>
        Spacecraft facts from the <a href="https://nssdc.gsfc.nasa.gov/nmc/" target="_blank" rel="noreferrer">NASA Space Science Data Coordinated Archive</a>,
        lessons from the <a href="https://llis.nasa.gov/" target="_blank" rel="noreferrer">NASA Lessons Learned Information System</a> and the reports linked on
        each case file, and the 57% figure from the <a href={IG_URL} target="_blank" rel="noreferrer">NASA Inspector General</a>.
      </>
    ),
  },
];

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const flyToday = useFlyToday();
  const streak = useGame((s) => s.streak);
  const today = useMemo(() => dailyBrief(new Date()), []);
  const cal = useMemo(() => calibration(), []);
  const sampleChallenge = useMemo(() => '/fly/' + encodeShare(REFERENCE_DESIGNS.jupiter, 4242), []);
  const juno = lessonById(COLD_OPENS[0].lessonId);

  // reveal on scroll
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
            Design a space mission. <em>Survive NASA&rsquo;s real failures.</em>
          </h1>
          <p className="lp-sub lp-rise" style={{ ['--d' as string]: '140ms' }}>
            Build a spacecraft to a real mission brief, pin the risks you see before launch, then fly into failures that really happened. Every one comes
            from NASA&rsquo;s own records, with its sources one tap away.
          </p>
          <div className="cta-row lp-rise" style={{ ['--d' as string]: '220ms' }}>
            <a className="btn btn-primary lp-btn-big" href={href('/play')}>Play free, no sign up</a>
            <Jump to="crisis" className="btn btn-ghost lp-btn-big">Try a real crisis</Jump>
          </div>
        </div>
        <HeroCraft />
        <ul className="lp-figures lp-rise" style={{ ['--d' as string]: '300ms' }} aria-label="Flown in numbers">
          {FIGURES.map((f) => (
            <li key={f.label}>
              <span className="lp-fig-n">{n0(f.n)}</span>
              <span className="lp-fig-l">{f.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 01 problem */}
      <Sec id="problem" no="01" kicker="The problem" title={<>The lessons exist. <em>They are not reaching people.</em></>}>
        <div className="lp-problem">
          <div className="lp-stat" data-reveal>
            <span className="lp-stat-n">57%</span>
            <p>
              of NASA flight project managers used NASA&rsquo;s own lessons learned database, the Inspector General found. The rest built without it.
            </p>
            <a className="cite" href={IG_URL} target="_blank" rel="noreferrer">NASA OIG report IG 12 012, 2012</a>
          </div>
          <div className="lp-stat" data-reveal style={{ ['--d' as string]: '120ms' }}>
            <span className="lp-stat-n alarm">30%</span>
            <p>
              of university class small satellites that reached orbit were dead on arrival, and another 15% failed early in their missions.
            </p>
            <a className="cite" href={SWARTWOUT_URL} target="_blank" rel="noreferrer">Swartwout study of 244 smallsats, The Space Review</a>
          </div>
          <p className="lp-problem-line" data-reveal>
            Students learn spacecraft one part at a time, rarely as a whole mission that can fail in a hundred ways. Flown is for students, teachers,
            space fans, and anyone who will one day build something that must not fail.
          </p>
        </div>
      </Sec>

      {/* 02 how it works */}
      <Sec id="how" no="02" kicker="How it works" title={<>Four steps. <em>One loop that teaches.</em></>}>
        <HowItWorks />
        <div className="cta-row lp-center" data-reveal>
          <a className="btn btn-primary" href={href('/play')}>Start a mission</a>
        </div>
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
        <p className="lp-lede" data-reveal>
          Each one links to its case file with the public record behind it. {PLAYABLE_LESSONS.length} can strike your craft in play. The rest are library
          reading in your lesson sky.
        </p>
        <div data-reveal>
          <Wall />
        </div>
        <div className="cta-row lp-wall-cta" data-reveal>
          {juno && <a className="btn btn-ghost" href={href('/case/' + juno.id)}>Open a case file</a>}
          <a className="btn btn-ghost" href={href('/proof')}>See all {LESSONS.length} with sources</a>
        </div>
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
              <dt>{MAX_PINS} pins per review</dt>
              <dd>You cannot pin everything. Choose like a real review board.</dd>
            </div>
            <div>
              <dt>Wrong pins cost you</dt>
              <dd>A pin on something with no real risk for your craft lowers your rate, so guessing never pays.</dd>
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
            <p className="lp-mode-t">Pass the phone around the table.</p>
            <p>
              Everyone builds for the same brief and seed, one turn each. The crew board ranks science that came home, plus every real failure caught
              before launch.
            </p>
            <ol className="lp-roster" aria-label="How a crew turn passes">
              <li className="done"><span>01</span>Player one builds and flies</li>
              <li className="now"><span>02</span>Pass the device</li>
              <li><span>03</span>Crew board</li>
            </ol>
            <a className="btn btn-primary" href={href('/crew')}>Form a crew</a>
          </div>
          <div className="lp-mode" data-reveal style={{ ['--d' as string]: '120ms' }}>
            <p className="lp-mode-k">Challenge a friend &middot; one link</p>
            <p className="lp-mode-t">Send one link. Beat their score.</p>
            <p>
              After any flight, copy the challenge link. Your friend sees your craft, flies the same seed against the same failures, and the scores sit side
              by side.
            </p>
            <code className="lp-link" title="A sample challenge link">#{sampleChallenge}</code>
            <a className="btn btn-ghost" href={href(sampleChallenge)}>Open a sample challenge</a>
          </div>
        </div>
      </Sec>

      {/* 07 proof */}
      <Sec id="proof" no="07" kicker="Proof" title={<>What is real, <em>and what is simplified.</em></>}>
        <div className="lp-proof">
          <div className="lp-truth" data-reveal>
            <div className="lp-truth-col">
              <p className="mono-label">Real</p>
              <ul>
                <li><b>{LESSONS.length} failures</b> and their {SOURCE_COUNT} public sources</li>
                <li><b>Crisis decisions</b> and the call NASA really made</li>
                <li><b>Spacecraft facts</b>: mass, rocket and launch date from NASA NSSDCA</li>
                <li><b>Mission budgets</b>, close to the real ones</li>
              </ul>
            </div>
            <div className="lp-truth-col">
              <p className="mono-label">Simplified for play</p>
              <ul>
                <li><b>Part values</b>: mass, power and cost are teaching values</li>
                <li><b>Failure chances</b>: how often a real failure strikes</li>
                <li><b>Dry mass limits</b> for each rocket</li>
              </ul>
            </div>
          </div>
          <div className="lp-cal" data-reveal>
            <p className="mono-label">Sizing check: a Flown design built like each real craft, weighed by the same rules you play with</p>
            <div className="table-scroll">
              <table className="proof-table lp-cal-table">
                <thead>
                  <tr><th>Real craft</th><th>NSSDCA</th><th>Flown</th><th>Error</th></tr>
                </thead>
                <tbody>
                  {cal.map((c) => (
                    <tr key={c.brief}>
                      <td>{c.source ? <a href={c.source} target="_blank" rel="noreferrer">{c.craft}</a> : c.craft}</td>
                      <td>{c.realMassKg != null ? kg(c.realMassKg) : 'Not listed'}</td>
                      <td>{kg(c.flownMassKg)}</td>
                      <td>{c.errPct === null ? 'n/a' : `${Math.abs(c.errPct)}%${c.errPct > 0 ? ' over' : c.errPct < 0 ? ' under' : ''}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lp-cal-note">Every row is shown, misses included. NSSDCA lists dry mass for some craft and launch mass for others.</p>
            <a className="btn btn-ghost" href={href('/proof')}>Open the full proof page</a>
          </div>
        </div>
      </Sec>

      {/* 08 faq */}
      <Sec id="faq" no="08" kicker="Questions" title={<>Plain answers.</>}>
        <div className="lp-faq" data-reveal>
          {FAQ.map((f, i) => (
            <details key={f.q} className="lp-qa" open={i === 0}>
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
            <p>A free browser game where you design a space mission and survive NASA&rsquo;s real failures.</p>
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
              <a href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer">Built for NASA Space Apps 2026</a>
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

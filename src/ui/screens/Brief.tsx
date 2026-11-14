import { BRIEFS, REAL_CRAFT, DIFFICULTY, dailyBrief, briefById } from '../eng';
import type { Brief as BriefT, Difficulty } from '../eng';
import { useGame } from '../store';
import { go, href } from '../router';
import { usd, kg, n0, two } from '../format';
import { TargetGlyph, More } from '../parts/Bits';

const DIFFS: Difficulty[] = ['cadet', 'engineer', 'veteran'];
const REACH: Record<BriefT['deltaVNeed'], number> = { low: 1, medium: 2, high: 3 };

/** Cadet, Engineer or Veteran as one segmented control. Shared by the brief screen and crew setup. */
export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="seg-wrap">
      <div className="seg" role="radiogroup" aria-label="Difficulty">
        {DIFFS.map((id) => {
          const d = DIFFICULTY[id];
          const on = value === id;
          return (
            <button key={id} role="radio" aria-checked={on} className={'seg-btn' + (on ? ' on' : '')} title={d.blurb} onClick={() => onChange(id)}>
              {d.label}
            </button>
          );
        })}
      </div>
      <span className="seg-note">{DIFFICULTY[value].blurb}</span>
    </div>
  );
}

/** Three pips for how hard the trip is on the engine. */
export function Reach({ need }: { need: BriefT['deltaVNeed'] }) {
  return (
    <span className="reach" title={`Engine demand: ${need}`} aria-label={`Engine demand ${need}`}>
      {[1, 2, 3].map((k) => <i key={k} className={k <= REACH[need] ? 'on' : ''} />)}
    </span>
  );
}

export function BriefTile({ b, i, onPick, budgetMult, label, radio, on }: { b: BriefT; i: number; onPick: () => void; budgetMult: number; label?: string; radio?: boolean; on?: boolean }) {
  const real = REAL_CRAFT[b.realCraft];
  return (
    <li className={'tile' + (on ? ' on' : '')}>
      <button
        className="tile-hit"
        onClick={onPick}
        {...(radio ? { role: 'radio', 'aria-checked': !!on } : { 'aria-label': label ?? `Fly ${b.title}` })}
        title={`${b.story} Up to ${b.maxInstruments} instruments.${real ? ` Modeled on ${real.name}.` : ''}`}
      >
        <span className="tile-top">
          <span className="tile-no">{two(i + 1)}</span>
          <span className="tile-target">{b.target}</span>
          <Reach need={b.deltaVNeed} />
        </span>
        <TargetGlyph id={b.id} />
        <span className="tile-title">{b.title}</span>
        <span className="tile-goal">{b.goal}</span>
        <span className="tile-nums">
          <span className="tile-budget">{usd(Math.round(b.budgetM * budgetMult))}</span>
          <span className="tile-sub">{kg(b.launchMassLimitKg)} &middot; {n0(b.missionDays)} days</span>
          {!radio && <span className="tile-start" aria-hidden="true">Start</span>}
        </span>
      </button>
    </li>
  );
}

export default function Brief() {
  const start = useGame((s) => s.startMission);
  const mission = useGame((s) => s.mission);
  const runs = useGame((s) => s.runs);
  const crew = useGame((s) => s.crew);
  const difficulty = useGame((s) => s.difficulty);
  const setDifficulty = useGame((s) => s.setDifficulty);
  const budgetMult = DIFFICULTY[difficulty].budgetMult;
  const coopOpen = crew?.mode === 'coop' && mission?.coop && !mission.run?.done ? crew : null;
  const crewOpen = coopOpen ?? (crew && crew.mode !== 'coop' && crew.turn < crew.players.length ? crew : null);
  const today = dailyBrief(new Date());
  const todayDone = runs.some((r) => r.daily && r.seed === today.seed && r.briefId === today.brief.id);

  const pick = (id: string, seed: number, daily: boolean) => {
    start(id, seed, daily);
    go('/hangar');
  };

  let resumeTitle: string | null = null;
  try {
    if (mission && !mission.run?.done) resumeTitle = briefById(mission.briefId).title;
  } catch {
    resumeTitle = null;
  }

  return (
    <div className="page brief-page">
      <header className="app-head">
        <div>
          <p className="eyebrow">Step 1 of 4 &middot; Mission brief</p>
          <h1 className="app-title">Choose where you are going.</h1>
        </div>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
      </header>

      <div className="brief-bar">
        <button className="today" onClick={() => pick(today.brief.id, today.seed, true)} aria-label={`Fly today’s mission, ${today.brief.title}`}>
          <span className="today-k">Today</span>
          <span className="today-t">{today.brief.title}</span>
          <span className="today-s">seed {today.seed}{todayDone ? ' · flown' : ''}</span>
          <svg className="today-go" viewBox="0 0 40 12" width="34" height="12" aria-hidden="true"><path d="M0 6 H38 M32 1 L38 6 L32 11" /></svg>
        </button>
        {resumeTitle && mission?.crewIndex === undefined && !mission?.coop && (
          <a className="chip-link" href={href('/hangar')}>Resume {resumeTitle}</a>
        )}
        <a className="chip-link" href={href(coopOpen ? '/hangar' : crewOpen ? '/crew/pass' : '/crew')}>
          {crewOpen ? `Resume crew of ${crewOpen.players.length}` : 'Fly as a crew'}
        </a>
      </div>

      <ul className="tiles">
        {BRIEFS.map((b, i) => (
          <BriefTile key={b.id} b={b} i={i} budgetMult={budgetMult} onPick={() => pick(b.id, Math.floor(Math.random() * 100000), false)} />
        ))}
      </ul>

      <More label="How briefs work" className="foot-more">
        <p>
          Each brief carries about the real mission&rsquo;s cost as its budget, and a simplified dry mass limit for a standard rocket. Your craft lives or dies inside them.
          Pips show how hard the trip is on the engine.
        </p>
        <p>Today&rsquo;s mission: everyone flying today gets the same failures in the same order. Seed {today.seed}.</p>
        <p>
          Crew, One craft: 2 to 4 players build one spacecraft together. Each role owns its systems and its review pins, the owner of a failing system makes the call in
          flight, and the craft launches only on a GO from everyone. Crew, Race: one craft each on the same seed, take turns, then compare.
        </p>
        <ul className="brief-facts">
          {BRIEFS.map((b) => {
            const real = REAL_CRAFT[b.realCraft];
            return (
              <li key={b.id}>
                <b>{b.title}</b> {b.story} Budget {usd(Math.round(b.budgetM * budgetMult))}, dry mass limit {kg(b.launchMassLimitKg)}, {n0(b.missionDays)} days, up to {b.maxInstruments} instruments
                {real ? `, modeled on ${real.name}` : ''}.
              </li>
            );
          })}
        </ul>
      </More>
    </div>
  );
}

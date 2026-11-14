import { BRIEFS, REAL_CRAFT, DIFFICULTY, dailyBrief, briefById } from '../eng';
import type { Brief as BriefT, Difficulty } from '../eng';
import { useGame } from '../store';
import { go, href } from '../router';
import { usd, kg, n0, two } from '../format';

const DIFFS: Difficulty[] = ['cadet', 'engineer', 'veteran'];

/** Cadet, Engineer or Veteran, in the option row style. Shared by the brief screen and crew setup. */
export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="opt-list" role="radiogroup" aria-label="Difficulty">
      {DIFFS.map((id) => {
        const d = DIFFICULTY[id];
        const on = value === id;
        return (
          <button key={id} role="radio" aria-checked={on} className={'opt' + (on ? ' on' : '')} onClick={() => onChange(id)}>
            <span className="opt-mark" aria-hidden="true" />
            <span className="opt-name">{d.label}</span>
            <span className="opt-blurb">{d.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

function BriefRow({ b, i, onPick, daily, budgetMult }: { b: BriefT; i: number; onPick: () => void; daily?: boolean; budgetMult: number }) {
  const real = REAL_CRAFT[b.realCraft];
  return (
    <li className={'brief-row' + (daily ? ' brief-daily' : '')}>
      <button className="brief-hit" onClick={onPick} aria-label={`Fly ${b.title}`}>
        <span className="brief-no">{daily ? 'Today' : two(i + 1)}</span>
        <span className="brief-main">
          <span className="brief-target">{b.target}</span>
          <span className="brief-title">{b.title}</span>
          <span className="brief-goal">{b.goal}</span>
          <span className="brief-story">{b.story}</span>
        </span>
        <span className="brief-specs">
          <span><em>Budget</em>{usd(Math.round(b.budgetM * budgetMult))}</span>
          <span><em>Dry mass limit</em>{kg(b.launchMassLimitKg)}</span>
          <span><em>Mission</em>{n0(b.missionDays)} days</span>
          <span><em>Instruments</em>up to {b.maxInstruments}</span>
          {real && <span className="brief-real"><em>Modeled on</em>{real.name}</span>}
        </span>
        <span className="brief-go" aria-hidden="true">
          <svg viewBox="0 0 40 12" width="40" height="12"><path d="M0 6 H38 M32 1 L38 6 L32 11" /></svg>
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
  const crewOpen = crew && crew.turn < crew.players.length ? crew : null;
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
      <header className="page-head">
        <p className="eyebrow">Step 1 of 4 &middot; Mission brief</p>
        <h1 className="page-title">Choose where you are going.</h1>
        <p className="page-lede">
          Each brief carries about the real mission&rsquo;s cost as its budget, and a simplified dry mass limit for a standard rocket. Your craft lives or dies inside them.
        </p>
        {resumeTitle && mission?.crewIndex === undefined && (
          <a className="resume" href={href('/hangar')}>
            Resume your craft for <b>{resumeTitle}</b>
          </a>
        )}
        <div className="paths">
          <p className="path path-solo">
            <span className="mono-label">Solo</span>
            Pick a brief below and fly it alone.
          </p>
          <p className="path path-crew">
            <span className="mono-label">Crew &middot; 2 to 4 players</span>
            One device, one brief, the same failures for everyone. Take turns, then compare.
            <a className="btn btn-ghost btn-small" href={href(crewOpen ? '/crew/pass' : '/crew')}>
              {crewOpen ? `Resume the crew of ${crewOpen.players.length}` : 'Fly as a crew'}
            </a>
          </p>
        </div>
      </header>

      <section className="daily">
        <p className="mono-label">Difficulty</p>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
      </section>

      <section className="daily">
        <p className="mono-label">
          Mission of the day {todayDone && <span className="done-tag">flown today</span>}
        </p>
        <ul className="brief-list">
          <BriefRow b={today.brief} i={0} daily budgetMult={budgetMult} onPick={() => pick(today.brief.id, today.seed, true)} />
        </ul>
        <p className="daily-note">Everyone flying today gets the same failures in the same order. Seed {today.seed}.</p>
      </section>

      <section>
        <p className="mono-label">All briefs</p>
        <ul className="brief-list">
          {BRIEFS.map((b, i) => (
            <BriefRow key={b.id} b={b} i={i} budgetMult={budgetMult} onPick={() => pick(b.id, Math.floor(Math.random() * 100000), false)} />
          ))}
        </ul>
      </section>
    </div>
  );
}

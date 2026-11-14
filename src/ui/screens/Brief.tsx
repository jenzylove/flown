import { BRIEFS, REAL_CRAFT, dailyBrief, briefById } from '../eng';
import type { Brief as BriefT } from '../eng';
import { useGame } from '../store';
import { go, href } from '../router';
import { usd, kg, n0, two } from '../format';

function BriefRow({ b, i, onPick, daily }: { b: BriefT; i: number; onPick: () => void; daily?: boolean }) {
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
          <span><em>Budget</em>{usd(b.budgetM)}</span>
          <span><em>Mass limit</em>{kg(b.launchMassLimitKg)}</span>
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
          Each brief carries the real mission&rsquo;s budget and the mass its era rocket could send. Your craft lives or dies inside them.
        </p>
        {resumeTitle && (
          <a className="resume" href={href('/hangar')}>
            Resume your craft for <b>{resumeTitle}</b>
          </a>
        )}
      </header>

      <section className="daily">
        <p className="mono-label">
          Mission of the day {todayDone && <span className="done-tag">flown today</span>}
        </p>
        <ul className="brief-list">
          <BriefRow b={today.brief} i={0} daily onPick={() => pick(today.brief.id, today.seed, true)} />
        </ul>
        <p className="daily-note">Everyone flying today gets the same failures in the same order. Seed {today.seed}.</p>
      </section>

      <section>
        <p className="mono-label">All briefs</p>
        <ul className="brief-list">
          {BRIEFS.map((b, i) => (
            <BriefRow key={b.id} b={b} i={i} onPick={() => pick(b.id, Math.floor(Math.random() * 100000), false)} />
          ))}
        </ul>
      </section>
    </div>
  );
}

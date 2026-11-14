import { useMemo, useState } from 'react';
import { BRIEFS, REAL_CRAFT, briefById, evaluate, crewScore, lessonById } from '../eng';
import type { FlightResult } from '../eng';
import { useGame } from '../store';
import type { Crew as CrewT } from '../store';
import { go, href } from '../router';
import { kg, usd, watts, pct, n0, two, prettyDate } from '../format';

const MAX = 4;
const MIN = 2;

export default function Crew({ view }: { view: string }) {
  if (view === 'pass') return <Pass />;
  if (view === 'board') return <Board />;
  return <Setup />;
}

/* ---------- setup ---------- */
function Setup() {
  const startCrew = useGame((s) => s.startCrew);
  const crew = useGame((s) => s.crew);
  const [names, setNames] = useState<string[]>(['', '']);
  const [briefId, setBriefId] = useState<string | null>(null);
  const clean = names.map((n) => n.trim());
  const dupes = new Set(clean.filter((n, i) => n && clean.findIndex((x) => x.toLowerCase() === n.toLowerCase()) !== i));
  const ready = clean.every(Boolean) && dupes.size === 0 && !!briefId;
  const unfinished = crew && crew.turn < crew.players.length ? crew : null;

  const start = () => {
    if (!ready || !briefId) return;
    startCrew(clean, briefId);
    go('/crew/pass');
  };

  return (
    <div className="page crew-page">
      <header className="page-head">
        <p className="eyebrow">Crew mode &middot; one device, {MIN} to {MAX} players</p>
        <h1 className="page-title">Fly as a crew.</h1>
        <p className="page-lede">
          Everyone gets the same brief and the same seed, so each real failure rolls the same dice for every craft. Take turns: build, review, fly, then pass the device.
          The crew board ranks you at the end.
        </p>
        {unfinished && (
          <a className="resume" href={href('/crew/pass')}>
            Resume the crew of {unfinished.players.map((p) => p.name).join(', ')}
          </a>
        )}
      </header>

      <section className="crew-sec">
        <p className="mono-label">01 &middot; The crew</p>
        <ol className="crew-names">
          {names.map((n, i) => (
            <li key={i}>
              <label className="crew-no" htmlFor={'crew-name-' + i}>{two(i + 1)}</label>
              <input
                id={'crew-name-' + i}
                className={'crew-input' + (dupes.has(clean[i]) ? ' bad' : '')}
                value={n}
                maxLength={14}
                placeholder={`Player ${i + 1} name`}
                autoComplete="off"
                onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {names.length > MIN && (
                <button className="link-quiet crew-x" onClick={() => setNames(names.filter((_, j) => j !== i))} aria-label={`Remove player ${i + 1}`}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>
        {names.length < MAX && (
          <button className="link-quiet" onClick={() => setNames([...names, ''])}>Add a player</button>
        )}
        {dupes.size > 0 && <p className="rv-why">Two players share a name. Give each one their own.</p>}
      </section>

      <section className="crew-sec">
        <p className="mono-label">02 &middot; One brief for everyone</p>
        <div className="opt-list" role="radiogroup" aria-label="Mission brief">
          {BRIEFS.map((b) => {
            const on = briefId === b.id;
            const real = REAL_CRAFT[b.realCraft];
            return (
              <button key={b.id} role="radio" aria-checked={on} className={'opt' + (on ? ' on' : '')} onClick={() => setBriefId(b.id)}>
                <span className="opt-mark" aria-hidden="true" />
                <span className="opt-name">{b.title}</span>
                <span className="opt-blurb">{b.goal}</span>
                <span className="opt-specs">
                  <span>{usd(b.budgetM)} budget</span>
                  <span>{kg(b.launchMassLimitKg)} limit</span>
                  {real && <span>Modeled on {real.name}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="cta-row">
        <button className="btn btn-primary" disabled={!ready} onClick={start}>Start the crew</button>
        <a className="btn btn-ghost" href={href('/brief')}>Fly solo instead</a>
      </div>
    </div>
  );
}

/* ---------- handoff ---------- */
function Pass() {
  const crew = useGame((s) => s.crew);
  const begin = useGame((s) => s.beginCrewTurn);
  const endCrew = useGame((s) => s.endCrew);
  if (!crew) return <NoCrew />;
  if (crew.turn >= crew.players.length) {
    return (
      <div className="page empty-page">
        <p className="eyebrow">Crew mode</p>
        <h1 className="page-title">Every craft has flown.</h1>
        <div className="cta-row"><a className="btn btn-primary" href={href('/crew/board')}>Open the crew board</a></div>
      </div>
    );
  }
  const brief = briefById(crew.briefId);
  const p = crew.players[crew.turn];
  const prev = crew.turn > 0 ? crew.players[crew.turn - 1] : null;
  const start = () => {
    begin();
    go('/hangar');
  };
  return (
    <div className="page pass-page">
      <p className="eyebrow">Crew mode &middot; turn {crew.turn + 1} of {crew.players.length} &middot; {brief.title}</p>
      <h1 className="pass-title">
        <span className="pass-small">{prev ? `${prev.name} has flown.` : 'First up.'}</span>
        Pass the device to <em>{p.name}</em>.
      </h1>
      <p className="page-lede">
        {prev ? `${prev.name}’s craft stays hidden until the crew board. ` : ''}
        {p.name}, you are flying the {brief.title} brief on seed {crew.seed}. Same seed as everyone, so the same dice for every real failure.
      </p>
      <ol className="pass-roster" aria-label="Crew">
        {crew.players.map((x, i) => (
          <li key={x.name} className={x.done ? 'done' : i === crew.turn ? 'now' : ''}>
            <span className="crew-no">{two(i + 1)}</span>
            <span className="pr-name">{x.name}</span>
            <span className="pr-state">{x.done ? 'Flown' : i === crew.turn ? 'Up now' : 'Waiting'}</span>
          </li>
        ))}
      </ol>
      <div className="cta-row">
        <button className="btn btn-primary" onClick={start}>I am {p.name}. Open the hangar</button>
      </div>
      <button className="link-quiet" onClick={() => { endCrew(); go('/brief'); }}>Abandon this crew</button>
    </div>
  );
}

function NoCrew() {
  return (
    <div className="page empty-page">
      <p className="eyebrow">Crew mode</p>
      <h1 className="page-title">No crew on this device.</h1>
      <p className="page-lede">Gather two to four players around one screen and pick a brief together.</p>
      <div className="cta-row"><a className="btn btn-primary" href={href('/crew')}>Form a crew</a></div>
    </div>
  );
}

/* ---------- board ---------- */
type Done = { name: string; i: number; result: FlightResult; score: number; design: NonNullable<CrewT['players'][number]['design']> };

function Board() {
  const crew = useGame((s) => s.crew);
  const startCrew = useGame((s) => s.startCrew);
  const endCrew = useGame((s) => s.endCrew);
  const done: Done[] = useMemo(
    () =>
      (crew?.players ?? [])
        .map((p, i) => (p.done && p.result && p.design ? { name: p.name, i, result: p.result, design: p.design, score: crewScore(p.result) } : null))
        .filter((x): x is Done => !!x),
    [crew],
  );
  if (!crew) return <NoCrew />;
  if (done.length < crew.players.length) {
    return (
      <div className="page empty-page">
        <p className="eyebrow">Crew board</p>
        <h1 className="page-title">Not everyone has flown.</h1>
        <p className="page-lede">{crew.players.filter((p) => !p.done).map((p) => p.name).join(' and ')} still {crew.players.filter((p) => !p.done).length === 1 ? 'has' : 'have'} a turn.</p>
        <div className="cta-row"><a className="btn btn-primary" href={href('/crew/pass')}>Back to the handoff</a></div>
      </div>
    );
  }
  const brief = briefById(crew.briefId);
  const real = REAL_CRAFT[brief.realCraft];
  const ranked = [...done].sort((a, b) => b.score - a.score || b.result.sciencePct - a.result.sciencePct);
  const top = ranked[0].score;
  const winners = ranked.filter((x) => x.score === top);
  const reports = done.map((d) => evaluate(d.design));
  const lessonIds = [...new Set(done.flatMap((d) => [...d.result.triggered, ...d.result.caught, ...(d.result.prevented ?? []), ...d.result.missed]))];
  const mark = (r: FlightResult, id: string) => {
    if ((r.prevented ?? []).includes(id)) return { t: 'Fixed in time', c: '' };
    if (r.triggered.includes(id)) return { t: r.caught.includes(id) ? 'Hit, pinned' : 'Hit', c: 'bad' };
    if (r.caught.includes(id)) return { t: 'Caught', c: '' };
    return { t: 'Spared', c: 'dim' };
  };

  return (
    <div className="page board-page">
      <header className="page-head">
        <p className="eyebrow">Crew board &middot; {brief.title} &middot; seed {crew.seed} &middot; {prettyDate(crew.startedAt)}</p>
        <h1 className="page-title">
          {winners.length > 1 ? `${winners.map((w) => w.name).join(' and ')} share the top.` : `${winners[0].name} flew it best.`}
        </h1>
        <p className="page-lede">
          Score is science percent, plus 15 for each real failure caught at review, minus 5 for each one missed. One seed for everyone, so each real failure rolled the same dice for every craft. Only the craft and the calls differed.
        </p>
      </header>

      <ol className="board">
        {ranked.map((d, k) => (
          <li key={d.name} className={k === 0 ? 'first' : ''} style={{ animationDelay: `${k * 90}ms` }}>
            <span className="bd-rank">{two(k + 1)}</span>
            <span className="bd-name">{d.name}</span>
            <span className="bd-stat"><em>Science</em>{pct(d.result.sciencePct)}</span>
            <span className="bd-stat"><em>Caught</em>{n0(d.result.caught.length)}</span>
            <span className={'bd-stat' + (d.result.missed.length ? ' bad' : '')}><em>Missed</em>{n0(d.result.missed.length)}</span>
            <span className="bd-score">{n0(d.score)}</span>
          </li>
        ))}
      </ol>

      <section className="board-sec">
        <div className="sec-head"><span className="sec-no">01</span><h2>Your craft against the real one</h2></div>
        <div className="table-scroll">
          <table className="vs-table board-table">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{real ? real.name : 'Real craft'}</th>
                {done.map((d) => <th scope="col" key={d.name}>{d.name}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Mass<small> (real: NSSDCA listed)</small></th>
                <td>{real?.mass_kg != null ? kg(real.mass_kg) : 'Not in the archive'}</td>
                {reports.map((r, i) => <td key={i}>{kg(r.massKg)}</td>)}
              </tr>
              <tr>
                <th scope="row">Power</th>
                <td>{real?.power_w != null ? watts(real.power_w) : 'Not in the archive'}</td>
                {reports.map((r, i) => <td key={i}>{watts(r.powerGenW)}</td>)}
              </tr>
              <tr>
                <th scope="row">Cost</th>
                <td>{usd(brief.budgetM)}<span className="cell-note">{brief.budgetNote}</span></td>
                {reports.map((r, i) => <td key={i}>{usd(r.costM)}</td>)}
              </tr>
              <tr>
                <th scope="row">Rocket</th>
                <td>{real?.launch_vehicle ?? 'Not in the archive'}</td>
                <td colSpan={done.length} className="dim">Your rocket could lift {kg(brief.launchMassLimitKg)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {real && (
          <p className="vs-note">
            {real.name} figures from the <a href={real.source} target="_blank" rel="noreferrer">NASA Space Science Data Coordinated Archive</a>.
          </p>
        )}
      </section>

      <section className="board-sec">
        <div className="sec-head"><span className="sec-no">02</span><h2>Which real failures hit whom</h2></div>
        {lessonIds.length === 0 ? (
          <p className="result-quiet">Nothing from the lesson library came for any craft on this seed.</p>
        ) : (
          <div className="table-scroll">
            <table className="vs-table board-table">
              <thead>
                <tr>
                  <th scope="col">Case file</th>
                  {done.map((d) => <th scope="col" key={d.name}>{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {lessonIds.map((id) => (
                  <tr key={id}>
                    <td className="bd-case"><a href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a></td>
                    {done.map((d) => {
                      const m = mark(d.result, id);
                      return <td key={d.name} className={m.c === 'bad' ? 'alarm' : m.c}>{m.t}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="vs-note">Every lesson above is now a star in the Lesson Sky on this device.</p>
      </section>

      <div className="cta-row">
        <button className="btn btn-primary" onClick={() => { startCrew(crew.players.map((p) => p.name), crew.briefId); go('/crew/pass'); }}>
          Rematch on a new seed
        </button>
        <a className="btn btn-ghost" href={href('/sky')}>Lesson sky</a>
        <button className="btn btn-ghost" onClick={() => { endCrew(); go('/crew'); }}>New crew</button>
      </div>
    </div>
  );
}

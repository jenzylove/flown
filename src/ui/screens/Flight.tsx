import { useEffect, useMemo, useRef, useState } from 'react';
import { briefById, lessonById, nasaChoice, reviewItems, riskProfile } from '../eng';
import type { FlightEvent, FailureAnim } from '../eng';
import { useGame, ANIM_SLOT } from '../store';
import { Craft3D } from '../Shell';
import { looksOf, instrumentLooks } from '../craftLooks';
import { go, href } from '../router';
import { n0, pct } from '../format';
import { NoMission } from './NoMission';
import { ShareBox, ComparePanel } from '../parts/Versus';

const PHASES: FlightEvent['phase'][] = ['launch', 'cruise', 'arrival', 'operations', 'end'];
const PHASE_NAME: Record<FlightEvent['phase'], string> = {
  launch: 'Launch',
  cruise: 'Cruise',
  arrival: 'Arrival',
  operations: 'Operations',
  end: 'End',
};
const OUTCOME: Record<string, string> = { success: 'Mission success', degraded: 'Mission degraded', lost: 'Mission lost' };

export default function Flight() {
  const mission = useGame((s) => s.mission);
  const resolve = useGame((s) => s.resolve);
  const record = useGame((s) => s.record);
  const refly = useGame((s) => s.refly);
  const launch = useGame((s) => s.launch);
  const crew = useGame((s) => s.crew);
  const run = mission?.run ?? null;
  const events = run?.events ?? [];
  const [shown, setShown] = useState(() => (mission?.run?.done && mission.recorded ? mission.run.events.length : 0));
  const [nasaNotes, setNasaNotes] = useState<Record<number, { yours: string; nasa: string; same: boolean }>>({});
  const logRef = useRef<HTMLOListElement>(null);

  // reveal events one at a time
  useEffect(() => {
    if (!run) return;
    if (shown >= events.length) return;
    const ev = events[shown];
    const wait = shown === 0 ? 700 : ev?.kind === 'nominal' ? 1300 : 2200;
    const id = window.setTimeout(() => setShown((s) => s + 1), wait);
    return () => window.clearTimeout(id);
  }, [shown, events, run]);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [shown]);

  const allShown = run ? shown >= events.length : false;
  const finished = !!run?.done && allShown;
  useEffect(() => {
    if (finished) record();
  }, [finished, record]);

  const items = useMemo(() => (mission ? reviewItems(mission.design) : []), [mission]);

  if (!mission) return <NoMission />;
  const brief = briefById(mission.briefId);

  if (!run) {
    return (
      <div className="page empty-page">
        <p className="eyebrow">{brief.title}</p>
        <h1 className="page-title">No flight in the air.</h1>
        <p className="page-lede">A flight only lives while this tab is open. Launch again from the review, with the same seed.</p>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={() => { launch(); setShown(0); }}>Launch again</button>
          <a className="btn btn-ghost" href={href('/review')}>Back to the review</a>
        </div>
      </div>
    );
  }

  const visible = events.slice(0, shown);
  const current = visible[visible.length - 1];
  const lastBad = [...visible].reverse().find((e) => e.anim && e.anim !== 'none');
  const anim: FailureAnim = lastBad?.anim ?? 'none';
  const animKey = lastBad ? visible.lastIndexOf(lastBad) : 0;
  const crisis = allShown ? run.pendingCrisis : undefined;
  const lost = run.result?.outcome === 'lost' && finished;
  const savedNow = current?.kind === 'save';
  const glowSlots = lastBad?.anim ? [ANIM_SLOT[lastBad.anim]].filter((x): x is NonNullable<typeof x> => !!x) : [];

  const span = Math.max(1, brief.missionDays);
  const skipAhead = () => setShown(events.length);

  const choose = (optionId: string, label: string) => {
    if (!crisis) return;
    const n = nasaChoice(crisis.lessonId);
    const idx = events.length; // the resolution event lands here
    if (n) {
      const nasaLabel = crisis.options.find((o) => o.id === n.optionId)?.label ?? n.text;
      setNasaNotes((m) => ({ ...m, [idx]: { yours: label, nasa: n.text || nasaLabel, same: n.optionId === optionId } }));
    }
    resolve(optionId);
  };

  const r = run.result;
  const crewTurn = mission.crewIndex !== undefined && crew && crew.briefId === mission.briefId && crew.seed === mission.seed ? crew : null;
  const crewName = crewTurn ? crewTurn.players[mission.crewIndex!]?.name : null;
  const nextUp = crewTurn && crewTurn.turn < crewTurn.players.length ? crewTurn.players[crewTurn.turn] : null;
  const labelFor = (id: string) => items.find((i) => i.id === id)?.label ?? id;

  return (
    <div className={'page flight' + (lost ? ' is-lost' : '')}>
      <header className="page-head flight-head">
        <p className="eyebrow">{crewName ? `${crewName} flying` : 'Step 4 of 4'} &middot; Flight &middot; {brief.title} &middot; seed {run.seed}</p>
        <h1 className="page-title">{finished && r ? OUTCOME[r.outcome] : current ? `Day ${n0(current.day)}` : 'Countdown'}</h1>
      </header>

      <div className="timeline" aria-hidden="true">
        <div className="tl-axis">
          {visible.map((e, i) => (
            <span
              key={i}
              className={'tl-mark k-' + e.kind}
              style={{ left: `${Math.min(100, (e.day / span) * 100)}%` }}
              title={`Day ${n0(e.day)}`}
            />
          ))}
          <span className="tl-head" style={{ left: `${Math.min(100, ((current?.day ?? 0) / span) * 100)}%` }} />
        </div>
        <div className="tl-phases">
          {PHASES.map((p) => (
            <span key={p} className={visible.some((e) => e.phase === p) ? 'on' : ''}>{PHASE_NAME[p]}</span>
          ))}
        </div>
      </div>

      <div className="flight-grid">
        <div className="craft-frame flight-frame">
          <Craft3D
            className="flight-craft"
            looks={looksOf(run.design)}
            instruments={instrumentLooks(run.design)}
            anim={anim}
            animKey={animKey}
            glow={finished ? glowSlots : []}
            beam={!lost}
            lander={brief.kind === 'lander'}
          />
          <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
          {savedNow && current?.lessonId && (
            <a className="save-flash" href={href('/case/' + current.lessonId)}>
              <span className="mono-label">Caught before launch</span>
              <span>{lessonById(current.lessonId)?.mission}</span>
            </a>
          )}
          {current && current.kind !== 'nominal' && !savedNow && (
            <span className="frame-label alarm">{PHASE_NAME[current.phase]} &middot; day {n0(current.day)}</span>
          )}
        </div>

        <div className="flight-side">
          <ol className="log" ref={logRef}>
            {visible.map((e, i) => {
              const note = nasaNotes[i];
              return (
                <li key={i} className={'log-row k-' + e.kind}>
                  <span className="log-day">Day {n0(e.day)}</span>
                  <span className="log-text">
                    {e.kind === 'save' && <b className="save-tag">Fix held</b>}
                    {e.text}
                    {note && (
                      <span className="log-nasa">
                        You chose: {note.yours.replace(/\.$/, '')}. NASA: {note.nasa.replace(/\.$/, '')}.
                      </span>
                    )}
                    {e.lessonId && (e.kind !== 'nominal' || note) && (
                      <a className="log-case" href={href('/case/' + e.lessonId)}>Case file: {lessonById(e.lessonId)?.mission}</a>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          {!allShown && (
            <button className="link-quiet" onClick={skipAhead}>Skip ahead</button>
          )}

          {crisis && (
            <section className="crisis" role="dialog" aria-label="Crisis" ref={(el) => { if (el && window.innerWidth < 1000) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <p className="mono-label alarm">Crisis &middot; day {n0(crisis.day)} &middot; {lessonById(crisis.lessonId)?.mission}</p>
              <p className="crisis-prompt">{crisis.prompt}</p>
              <div className="choice-list">
                {crisis.options.map((o, i) => (
                  <button key={o.id} className="choice" disabled={!o.available} onClick={() => choose(o.id, o.label)}>
                    <span className="choice-key">{String.fromCharCode(65 + i)}</span>
                    <span className="choice-label">
                      {o.label}
                      {!o.available && o.why && <span className="choice-why">{o.why}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {finished && r && (
            <section className="result" ref={(el) => { if (el && window.innerWidth < 1000) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <div className="result-score">
                <span className="result-num">{pct(r.sciencePct)}</span>
                <span className="result-cap">of planned science came home</span>
              </div>
              <dl className="result-lists">
                <ResultGroup title="Prevented by your fixes" ids={r.prevented ?? []} tone="good" />
                <ResultGroup title="Pinned, not fixed" ids={r.caught.filter((id) => !(r.prevented ?? []).includes(id))} tone="mid" />
                <ResultGroup title="Missed at review" ids={r.missed} tone="bad" />
                <ResultGroup title="Real risks on your craft that stayed quiet this flight" ids={riskProfile(run.design).map((x) => x.lessonId).filter((id) => !r.triggered.includes(id) && !(r.prevented ?? []).includes(id) && !r.caught.includes(id) && !r.missed.includes(id))} tone="mid" />
                {r.falseFlags.length > 0 && (
                  <div className="rl">
                    <dt>Pins on parts with no known failure in the library</dt>
                    <dd>
                      <ul>{r.falseFlags.map((f) => <li key={f}>{labelFor(f)}</li>)}</ul>
                    </dd>
                  </div>
                )}
                {r.caught.length + r.missed.length === 0 && (
                  <p className="result-quiet">Nothing from the lesson library struck this craft on this seed.</p>
                )}
              </dl>
              {mission.challenge && mission.recorded && <ComparePanel mission={mission} design={run.design} result={r} />}
              {crewTurn ? (
                <div className="cta-row">
                  {nextUp ? (
                    <button className="btn btn-primary" onClick={() => go('/crew/pass')}>Pass the device to {nextUp.name}</button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => go('/crew/board')}>See the crew board</button>
                  )}
                </div>
              ) : (
                <div className="cta-row">
                  {r.triggered.length + r.missed.length > 0 && (
                    <button className="btn btn-primary" onClick={() => { refly(); go('/refly'); }}>Fix it and refly</button>
                  )}
                  <ShareBox mission={mission} />
                  <a className="btn btn-ghost" href={href('/sky')}>Lesson sky</a>
                  <a className="btn btn-ghost" href={href('/brief')}>New mission</a>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ title, ids, tone }: { title: string; ids: string[]; tone: 'good' | 'mid' | 'bad' }) {
  if (ids.length === 0) return null;
  return (
    <div className={'rl rl-' + tone}>
      <dt>{title} <em>{ids.length}</em></dt>
      <dd>
        <ul>
          {ids.map((id) => (
            <li key={id}>
              <a href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

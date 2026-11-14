import { useEffect, useMemo, useRef, useState } from 'react';
import { briefById, lessonById, nasaChoice, reviewItems, riskProfile } from '../eng';
import type { FlightEvent, FailureAnim } from '../eng';
import { useGame, ANIM_SLOT } from '../store';
import { Craft3D } from '../Shell';
import { looksOf, instrumentLooks } from '../craftLooks';
import { go, href } from '../router';
import { n0, pct, sep } from '../format';
import { NoMission } from './NoMission';
import { ShareBox, ComparePanel } from '../parts/Versus';
import { More, splitFirst } from '../parts/Bits';
import { useCoop, TeamBoard } from '../parts/Coop';
import { ownerOfLesson, itemOfLesson, groupOfItem, roleOfGroup } from '../coop';

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
  const coopCall = useGame((s) => s.coopCall);
  const startCoop = useGame((s) => s.startCoop);
  const coop = useCoop();
  const run = mission?.run ?? null;
  const events = run?.events ?? [];
  const [shown, setShown] = useState(() => (mission?.run?.done && mission.recorded ? mission.run.events.length : 0));
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({});
  const [nasaNotes, setNasaNotes] = useState<Record<number, { yours: string; nasa: string; same: boolean }>>({});
  const logRef = useRef<HTMLOListElement>(null);
  const crisisRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLElement>(null);

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

  // On narrow screens bring a new crisis, then the result, into view. Scrolling lives in effects so
  // nothing touches the DOM while React is committing it.
  const crisisKey = allShown && run?.pendingCrisis ? `${run.pendingCrisis.lessonId}:${run.pendingCrisis.day}` : null;
  useEffect(() => {
    if (!crisisKey) return;
    // The crisis is a focused panel over the board: put the keyboard on its first open choice.
    const id = window.requestAnimationFrame(() => crisisRef.current?.querySelector<HTMLButtonElement>('button.choice:not([disabled])')?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(id);
  }, [crisisKey]);
  const showResult = finished && !!run?.result;
  useEffect(() => {
    if (!showResult || window.innerWidth >= 1000) return;
    const id = window.requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => window.cancelAnimationFrame(id);
  }, [showResult]);

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
  // Phase labels sit where their days are: arrival at the arrival day, cruise and operations centred in their spans.
  const arrivePct = Math.min(100, (brief.arrivalDay / span) * 100);
  const phaseAt = [0, arrivePct / 2, arrivePct, (arrivePct + 100) / 2, 100];
  // A label that would collide with its neighbour is left off; its tick and band stay on the axis.
  const GAP = typeof window !== 'undefined' && window.innerWidth < 600 ? 24 : 12;
  const phaseHidden = [false, arrivePct < 2 * GAP, arrivePct < GAP || 100 - arrivePct < GAP / 2, 100 - arrivePct < 2 * GAP, false];
  const skipAhead = () => setShown(events.length);

  const choose = (optionId: string, label: string) => {
    if (!crisis) return;
    const n = nasaChoice(crisis.lessonId);
    const idx = events.length; // the resolution event lands here
    if (n) {
      const nasaLabel = crisis.options.find((o) => o.id === n.optionId)?.label ?? n.text;
      setNasaNotes((m) => ({ ...m, [idx]: { yours: label, nasa: n.text || nasaLabel, same: n.optionId === optionId } }));
    }
    if (coop) coopCall(crisis.lessonId, ownerOfLesson(coop.players.length, crisis.lessonId), n ? n.optionId === optionId : null);
    resolve(optionId);
  };

  const r = run.result;
  const crewTurn = mission.crewIndex !== undefined && crew && crew.briefId === mission.briefId && crew.seed === mission.seed ? crew : null;
  const crewName = crewTurn ? crewTurn.players[mission.crewIndex!]?.name : null;
  const nextUp = crewTurn && crewTurn.turn < crewTurn.players.length ? crewTurn.players[crewTurn.turn] : null;
  const decider = coop && crisis
    ? { name: coop.players[ownerOfLesson(coop.players.length, crisis.lessonId)]?.name, role: roleOfGroup(coop.players.length, groupOfItem(itemOfLesson(crisis.lessonId) ?? '')).name }
    : null;
  const labelFor = (id: string) => items.find((i) => i.id === id)?.label ?? id;

  const logOpen = (i: number) => setOpenRows((m) => ({ ...m, [i]: !m[i] }));
  const clean = (t: string) => t.replace(/\.$/, '');

  const log = (
    <ol className="log" ref={logRef}>
      {visible.map((e, i) => {
        const note = nasaNotes[i];
        const [head, rest] = splitFirst(e.text);
        const latest = i === visible.length - 1 && !finished;
        const expanded = latest || !!openRows[i];
        return (
          <li key={i} className={'log-row k-' + e.kind + (latest ? ' latest' : '')}>
            <span className="log-day">{n0(e.day)}</span>
            <span className="log-text">
              {e.kind === 'save' && <b className="save-tag">Fix held</b>}
              {(rest || note) && !latest ? (
                <button className="log-line" onClick={() => logOpen(i)} aria-expanded={expanded}>
                  {head}{expanded ? (rest ? <> {rest}</> : null) : <span className="log-more" aria-hidden="true"> +</span>}
                </button>
              ) : (
                <>{head}{rest && <> {rest}</>}</>
              )}
              {note && expanded && (
                <span className="log-nasa">You chose: {clean(note.yours)}. NASA: {clean(note.nasa)}.</span>
              )}
              {(note || (e.lessonId && e.kind !== 'nominal')) && (
                <span className="log-chips">
                  {note && <span className={'chip' + (note.same ? '' : ' chip-dim')}>{note.same ? 'Same call as NASA' : 'NASA chose otherwise'}</span>}
                  {e.lessonId && (e.kind !== 'nominal' || note) && (
                    <a className="chip" href={href('/case/' + e.lessonId)}>Case file: {lessonById(e.lessonId)?.mission}</a>
                  )}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );

  const quiet = r
    ? riskProfile(run.design).map((x) => x.lessonId).filter((id) => !r.triggered.includes(id) && !(r.prevented ?? []).includes(id) && !r.caught.includes(id) && !r.missed.includes(id))
    : [];
  const pinnedNotFixed = r ? r.caught.filter((id) => !(r.prevented ?? []).includes(id)) : [];

  return (
    <div className={'page flight' + (lost ? ' is-lost' : '') + (finished ? ' is-done' : '')}>
      <header className="app-head flight-head">
        <div>
          <p className="eyebrow">{coop ? 'One craft' : crewName ? `${crewName} flying` : 'Step 4 of 4'} &middot; Flight &middot; {brief.title} &middot; seed {run.seed}</p>
          <h1 className="app-title">{finished && r ? OUTCOME[r.outcome] : current ? `Day ${n0(current.day)}` : 'Countdown'}</h1>
        </div>
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
          <span className="tl-band" style={{ left: 0, width: `${arrivePct}%` }} title="Cruise" />
          <span className="tl-arrive" style={{ left: `${arrivePct}%` }} />
          <span className="tl-head" style={{ left: `${Math.min(100, ((current?.day ?? 0) / span) * 100)}%` }} />
        </div>
        <div className="tl-phases">
          {PHASES.map((p, k) => (
            <span
              key={p}
              className={(visible.some((e) => e.phase === p) ? 'on' : '') + (k === 0 ? ' first' : k === PHASES.length - 1 ? ' last' : '') + (phaseHidden[k] ? ' hide' : '')}
              style={{ left: `${phaseAt[k]}%` }}
            >
              {PHASE_NAME[p]}
            </span>
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
          {finished && r && (
            <section className="result" ref={resultRef}>
              <div className="result-score">
                <span className="result-num">{pct(r.sciencePct)}</span>
                <span className="result-cap">of planned science came home</span>
              </div>
              {coop ? (
                <TeamBoard crew={coop} result={r} />
              ) : (
              <div className="result-groups">
                <ResultGroup title="Prevented" ids={r.prevented ?? []} tone="good" hint="Prevented by your fixes" />
                <ResultGroup title="Missed" ids={r.missed} tone="bad" hint="Missed at review" />
                <ResultGroup title="Quiet risks" ids={quiet} tone="mid" hint="Real risks on your craft that stayed quiet this flight" />
              </div>
              )}
              {!coop && (pinnedNotFixed.length > 0 || r.falseFlags.length > 0) && (
                <div className="result-extra">
                  {pinnedNotFixed.length > 0 && (
                    <p>
                      <span className="chip-k">Pinned, not fixed</span>
                      {pinnedNotFixed.map((id) => <a key={id} className="chip" href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>)}
                    </p>
                  )}
                  {r.falseFlags.length > 0 && (
                    <p title="Wrong pins, each one counts against your catch rate">
                      <span className="chip-k alarm">Wrong pins</span>
                      {r.falseFlags.map((f) => <span key={f} className="chip chip-dim">{labelFor(f)}</span>)}
                    </p>
                  )}
                </div>
              )}
              {r.caught.length + r.missed.length === 0 && (
                <p className="result-quiet">Nothing from the lesson library struck this craft on this seed.</p>
              )}
              {(r.notes.length > 0 || r.falseFlags.length > 0) && (
                <More label="Why this result" className="result-why">
                  {r.notes.length > 0 && (
                    <ul className="warnings">
                      {r.notes.map((n) => <li key={n}>{sep(n)}</li>)}
                    </ul>
                  )}
                  {r.falseFlags.length > 0 && <p className="dim">Each wrong pin counts against your catch rate.</p>}
                </More>
              )}
              {mission.challenge && mission.recorded && <ComparePanel mission={mission} design={run.design} result={r} />}
              {coop ? (
                <>
                  <div className="cta-row">
                    {(r.sciencePct < 100 || r.triggered.length + r.missed.length > 0) && (
                      <button className="btn btn-primary" onClick={() => { refly(); go('/refly'); }}>Fix it together and refly</button>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => { startCoop(coop.players.map((p) => p.name), coop.briefId, coop.difficulty); go('/hangar'); }}
                    >
                      Same crew, new seed
                    </button>
                  </div>
                  <p className="quiet-links">
                    <a href={href('/sky')}>Lesson sky</a>
                    <a href={href('/crew')}>New crew</a>
                  </p>
                </>
              ) : crewTurn ? (
                <div className="cta-row">
                  {nextUp ? (
                    <button className="btn btn-primary" onClick={() => go('/crew/pass')}>Pass the device to {nextUp.name}</button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => go('/crew/board')}>See the crew board</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="cta-row">
                    {(r.sciencePct < 100 || r.triggered.length + r.missed.length > 0) && (
                      <button className="btn btn-primary" onClick={() => { refly(); go('/refly'); }}>Fix it and refly</button>
                    )}
                    <ShareBox mission={mission} />
                  </div>
                  <p className="quiet-links">
                    <a href={href('/sky')}>Lesson sky</a>
                    <a href={href('/brief')}>New mission</a>
                  </p>
                </>
              )}
            </section>
          )}

          {finished ? <More label="Flight log" count={visible.length} className="log-wrap">{log}</More> : log}

          {!allShown && (
            <button className="link-quiet" onClick={skipAhead}>Skip ahead</button>
          )}

          {crisis && (
            <>
              <div className="crisis-veil" aria-hidden="true" />
              <section className="crisis" role="dialog" aria-modal="true" aria-label="Crisis" ref={crisisRef}>
                <p className="mono-label alarm">Crisis &middot; day {n0(crisis.day)} &middot; {lessonById(crisis.lessonId)?.mission}</p>
                {decider && (
                  <p className="crisis-owner">
                    {lessonById(crisis.lessonId)?.mission}: <b>{decider.name}</b> ({decider.role}) decides
                  </p>
                )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ title, ids, tone, hint }: { title: string; ids: string[]; tone: 'good' | 'mid' | 'bad'; hint?: string }) {
  return (
    <div className={'rg rg-' + tone + (ids.length === 0 ? ' rg-none' : '')} title={hint}>
      <span className="rg-num">{ids.length}</span>
      <span className="rg-title">{title}</span>
      {ids.length > 0 && (
        <span className="rg-chips">
          {ids.map((id) => (
            <a key={id} className="chip" href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>
          ))}
        </span>
      )}
    </div>
  );
}

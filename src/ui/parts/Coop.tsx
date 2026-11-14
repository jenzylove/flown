import type { ReactNode } from 'react';
import type { Crew, CoopState } from '../store';
import { useGame } from '../store';
import { roleById, rolesFor, itemOfLesson, ownerOfItem } from '../coop';
import { catchRate, lessonById } from '../eng';
import type { FlightResult } from '../eng';
import { href } from '../router';
import { pct } from '../format';

/** The current crew when the open mission is a one craft game, for components. */
export function useCoop(): (Crew & { coop: CoopState }) | null {
  const crew = useGame((s) => s.crew);
  const mission = useGame((s) => s.mission);
  if (!mission?.coop || crew?.mode !== 'coop' || !crew.coop || crew.briefId !== mission.briefId) return null;
  return crew as Crew & { coop: CoopState };
}

/** Short role labels for one player: "Lead + Propulsion". */
export function shortRoles(n: number, i: number) {
  return (rolesFor(n)[i] ?? []).map((r) => roleById(r).short).join(' + ');
}

/** The crew as a row of seats. Tapping a seat hands the device to that player. */
export function CoopStrip({
  crew, state, label = 'Crew', onPick,
}: {
  crew: Crew & { coop: CoopState };
  state: (i: number) => { text: string; tone?: 'good' | 'bad' };
  label?: string;
  onPick?: (i: number) => void;
}) {
  const n = crew.players.length;
  return (
    <ol className="coop-strip" aria-label={label}>
      {crew.players.map((p, i) => {
        const st = state(i);
        const now = i === crew.coop.active;
        const body: ReactNode = (
          <>
            <span className="cs-name">{p.name}</span>
            <span className="cs-role">{shortRoles(n, i)}</span>
            <span className={'cs-state' + (st.tone ? ' ' + st.tone : '')}>{st.text}</span>
          </>
        );
        return (
          <li key={p.name} className={now ? 'now' : ''}>
            {onPick ? (
              <button className="cs-hit" onClick={() => onPick(i)} aria-pressed={now} title={now ? `${p.name} holds the device` : `Pass the device to ${p.name}`}>
                {body}
              </button>
            ) : (
              <span className="cs-hit">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** After a one craft flight: each player against the systems they owned and the pins they placed. */
export function TeamBoard({ crew, result }: { crew: Crew & { coop: CoopState }; result: FlightResult }) {
  const n = crew.players.length;
  const pinOwner = crew.coop.pinOwner;
  const rate = catchRate([result]);
  const caughtBy = (i: number) => result.caught.filter((id) => (pinOwner[itemOfLesson(id) ?? ''] ?? -1) === i);
  const missedBy = (i: number) => result.missed.filter((id) => ownerOfItem(n, itemOfLesson(id) ?? '') === i);
  const wrongBy = (i: number) => (result.falseFlags ?? []).filter((f) => (pinOwner[f] ?? 0) === i);
  const callsBy = (i: number) => crew.coop.calls.filter((c) => c.player === i);
  const chips = (ids: string[], bad?: boolean) =>
    ids.map((id) => (
      <a key={id} className={'chip' + (bad ? ' chip-bad' : '')} href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>
    ));
  return (
    <div className="team">
      {rate !== null && (
        <div className="team-rate">
          <span className="team-num">{pct(rate * 100)}</span>
          <span className="team-cap">team catch rate</span>
        </div>
      )}
      <ol className="team-board" aria-label="Team board">
        {crew.players.map((p, i) => {
          const c = caughtBy(i);
          const m = missedBy(i);
          const w = wrongBy(i);
          const calls = callsBy(i);
          return (
            <li key={p.name}>
              <span className="tb-name">{p.name}<small>{shortRoles(n, i)}</small></span>
              <span className="tb-stat"><em>Caught</em>{c.length}</span>
              <span className={'tb-stat' + (m.length ? ' bad' : '')}><em>Missed</em>{m.length}</span>
              <span className={'tb-stat' + (w.length ? ' bad' : '')}><em>Wrong pins</em>{w.length}</span>
              <span className="tb-stat"><em>Calls</em>{calls.length}</span>
              {(c.length > 0 || m.length > 0) && (
                <span className="tb-chips">
                  {chips(c)}
                  {chips(m, true)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

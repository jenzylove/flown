import { useMemo, useRef, useState } from 'react';
import { evaluate, lessonById, crewScore } from '../eng';
import type { FlightResult, Design } from '../eng';
import type { Mission } from '../store';
import { readFriend, shareUrl, copyText } from '../share';
import { href } from '../router';
import { kg, usd, watts, pct, n0 } from '../format';

/** "Challenge a friend": copies the share link, and shows it in a field when the clipboard is blocked. */
export function ShareBox({ mission }: { mission: Mission }) {
  const url = useMemo(() => shareUrl(mission), [mission]);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const field = useRef<HTMLInputElement>(null);
  const copy = async () => {
    const ok = await copyText(url);
    setState(ok ? 'copied' : 'manual');
    if (!ok) window.setTimeout(() => field.current?.select(), 30);
  };
  return (
    <div className="share">
      <button className="btn btn-ghost" onClick={copy}>
        {state === 'copied' ? 'Link copied' : 'Challenge a friend'}
      </button>
      {state === 'copied' && (
        <p className="share-note">Send it to a friend. They fly your seed, so every real failure rolls the same dice for them.</p>
      )}
      {state === 'manual' && (
        <div className="share-manual">
          <label className="mono-label" htmlFor="share-field">Copying was blocked. Copy this link yourself</label>
          <input id="share-field" ref={field} className="share-field" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}

function Lessons({ ids, tone }: { ids: string[]; tone?: 'bad' }) {
  if (ids.length === 0) return <span className="dim">None</span>;
  return (
    <ul className={'vs-lessons' + (tone === 'bad' ? ' bad' : '')}>
      {ids.map((id) => (
        <li key={id}>
          <a href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>
        </li>
      ))}
    </ul>
  );
}

/** Side by side: the friend's craft and flight against the visitor's. Every number comes from the engine. */
export function ComparePanel({ mission, design, result }: { mission: Mission; design: Design; result: FlightResult }) {
  const ch = mission.challenge!;
  const friend = useMemo(() => readFriend(ch.code, ch.meta), [ch.code, ch.meta]);
  if (!friend) return null;
  const mine = evaluate(design);
  const f = friend.report;
  const fr = friend.result;
  const fScore = fr ? crewScore(fr) : null;
  const yScore = crewScore(result);
  const rows: [string, string, string][] = [
    ['Mass', kg(f.massKg), kg(mine.massKg)],
    ['Cost', usd(f.costM), usd(mine.costM)],
    ['Power', watts(f.powerGenW), watts(mine.powerGenW)],
    ['Science', fr ? pct(fr.sciencePct) : 'Not in the link', pct(result.sciencePct)],
    ['Caught', fr ? n0(fr.caught.length) : 'Not in the link', n0(result.caught.length)],
    ['Missed', fr ? n0(fr.missed.length) : 'Not in the link', n0(result.missed.length)],
    ['Wrong pins', fr ? n0(fr.falseFlags?.length ?? 0) : 'Not in the link', n0(result.falseFlags?.length ?? 0)],
    ['Score', fScore === null ? 'Not in the link' : n0(fScore), n0(yScore)],
  ];
  const verdict =
    fScore === null ? null : yScore > fScore ? 'You beat your friend.' : yScore < fScore ? 'Your friend flew it better.' : 'Dead level with your friend.';
  return (
    <section className="compare">
      <p className="mono-label">Your friend&rsquo;s craft against yours &middot; seed {friend.seed}{ch.mode === 'same' ? ' · the same design' : ''}</p>
      {verdict && <p className="compare-verdict">{verdict}</p>}
      <div className="table-scroll">
        <table className="vs-table compare-table">
          <thead>
            <tr><th scope="col"></th><th scope="col">Friend</th><th scope="col">You</th></tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={k}><th scope="row">{k}</th><td>{a}</td><td>{b}</td></tr>
            ))}
            <tr>
              <th scope="row">Hit by</th>
              <td>{fr ? <Lessons ids={fr.triggered} tone="bad" /> : <Lessons ids={friend.incoming} tone="bad" />}</td>
              <td><Lessons ids={result.triggered} tone="bad" /></td>
            </tr>
            <tr>
              <th scope="row">Stopped by a fix</th>
              <td>{fr ? <Lessons ids={fr.prevented ?? []} /> : <span className="dim">Not in the link</span>}</td>
              <td><Lessons ids={result.prevented ?? []} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="vs-note">
        Score is science percent, plus 15 for each real failure caught at review, minus 5 for each one missed, minus 5 for each pin on something with no real risk for that craft.
        {!fr && ' The link carried only the design, so the friend column lists the failures that come for that craft on this seed before any pins.'}
      </p>
    </section>
  );
}


import { useMemo, useState } from 'react';
import { LESSONS, PLAYABLE_LESSONS, BRIEFS, catchRate, dailyBrief, briefById, crewScore } from '../eng';
import { useGame } from '../store';
import { go, href } from '../router';
import { hash, pct, isoDay, prettyDate, n0, two } from '../format';
import { useNarrow } from '../../three/palette';
import { More } from '../parts/Bits';

const PAD = 46;

export interface Star {
  id: string;
  x: number;
  y: number;
  sub: string;
  mission: string;
  year: number;
  tw: number;
}

/** Deterministic layout: each lesson id hashes to a spot, then a fixed relaxation spreads crowded stars. */
export function layout(W: number, H: number): Star[] {
  const stars: Star[] = LESSONS.map((l) => {
    const h = hash(l.id);
    const h2 = hash(l.id + ':y');
    return {
      id: l.id,
      x: PAD + (h % 10000) / 10000 * (W - 2 * PAD),
      y: PAD + (h2 % 10000) / 10000 * (H - 2 * PAD),
      sub: l.subsystem,
      mission: l.mission,
      year: l.year,
      tw: (h % 1000) / 1000,
    };
  });
  for (let it = 0; it < 60; it++) {
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i];
        const b = stars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = Math.min(W, H) / 8.5;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
    for (const s of stars) {
      s.x = Math.min(W - PAD, Math.max(PAD, s.x));
      s.y = Math.min(H - PAD, Math.max(PAD, s.y));
    }
  }
  return stars;
}

export function shortName(m: string) {
  const s = m.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return s.length > 24 ? s.slice(0, 22).trim() + '…' : s;
}

export default function Sky() {
  const lessons = useGame((s) => s.lessons);
  const runs = useGame((s) => s.runs);
  const streak = useGame((s) => s.streak);
  const startMission = useGame((s) => s.startMission);
  const narrow = useNarrow();
  const W = narrow ? 600 : 1000;
  const H = narrow ? 860 : 600;
  const stars = useMemo(() => layout(W, H), [W, H]);
  const [hover, setHover] = useState<string | null>(null);

  const constellations = useMemo(() => {
    const by: Record<string, Star[]> = {};
    for (const s of stars) (by[s.sub] ??= []).push(s);
    const lines: [Star, Star][] = [];
    for (const list of Object.values(by)) {
      // minimum spanning tree per subsystem, short links only
      const inTree = [list[0]];
      const rest = list.slice(1);
      while (rest.length) {
        let best: [number, Star, Star] | null = null;
        for (const a of inTree) for (const b of rest) {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (!best || d < best[0]) best = [d, a, b];
        }
        if (!best) break;
        inTree.push(best[2]);
        rest.splice(rest.indexOf(best[2]), 1);
        if (best[0] < 230) lines.push([best[1], best[2]]);
      }
    }
    return lines;
  }, [stars]);

  const rate = catchRate(runs);
  const caughtN = runs.reduce((a, r) => a + r.caught.length, 0);
  const missedN = runs.reduce((a, r) => a + r.missed.length, 0);
  const wrongN = runs.reduce((a, r) => a + (r.falseFlags?.length ?? 0), 0);
  const statusOf = (id: string) => lessons[id]?.status ?? 'unseen';
  const count = (st: string) => LESSONS.filter((l) => statusOf(l.id) === st).length;
  const today = dailyBrief(new Date());
  const flownToday = runs.some((r) => r.daily && r.seed === today.seed && r.day === isoDay());
  const hov = hover ? stars.find((s) => s.id === hover) : null;
  const boards = BRIEFS.map((b) => ({
    brief: b,
    top: runs
      .filter((r) => r.briefId === b.id)
      .map((r) => ({ r, score: crewScore(r) }))
      .sort((a, z) => z.score - a.score || z.r.sciencePct - a.r.sciencePct)
      .slice(0, 5),
  })).filter((x) => x.top.length > 0);

  return (
    <div className="page sky-page">
      <header className="app-head sky-head">
        <div>
          <p className="eyebrow">Lesson sky &middot; {LESSONS.length} real failures</p>
          <h1 className="app-title">Every star is a real failure.</h1>
          <p className="sky-key">
            <span><i className="k-unseen" />Not met</span>
            <span><i className="k-hit" />Hit you</span>
            <span><i className="k-caught" />Caught</span>
            <span className="dim">Tap a star for its case file</span>
          </p>
        </div>
      </header>

      <div className="sky-wrap">
        <svg className="sky" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Lesson sky with ${LESSONS.length} stars`}>
          <defs>
            <radialGradient id="halo">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* reticle */}
          <g className="sky-reticle">
            <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.42} />
            <circle cx={W / 2} cy={H / 2} r={Math.min(W, H) * 0.27} />
            <line x1={W / 2} y1={10} x2={W / 2} y2={H - 10} />
            <line x1={10} y1={H / 2} x2={W - 10} y2={H / 2} />
          </g>
          <g className="sky-lines">
            {constellations.map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={statusOf(a.id) !== 'unseen' && statusOf(b.id) !== 'unseen' ? 'lit' : ''} />
            ))}
          </g>
          {stars.map((s) => {
            const st = statusOf(s.id);
            const playable = PLAYABLE_LESSONS.includes(s.id);
            return (
              <a
                key={s.id}
                href={href('/case/' + s.id)}
                className={`star st-${st}${playable ? '' : ' lib'}`}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.id)}
                onBlur={() => setHover(null)}
                style={{ ['--tw' as string]: `${s.tw * 3}s` }}
                aria-label={`${s.mission}, ${st === 'unseen' ? 'not met yet' : st === 'hit' ? 'hit your craft' : 'caught before launch'}`}
              >
                <circle cx={s.x} cy={s.y} r={22} className="star-hit" />
                {st === 'caught' && <circle cx={s.x} cy={s.y} r={18} fill="url(#halo)" className="star-halo" />}
                {st === 'caught' && (
                  <path className="star-spike" d={`M${s.x - 11} ${s.y}H${s.x + 11}M${s.x} ${s.y - 11}V${s.y + 11}`} />
                )}
                <circle cx={s.x} cy={s.y} r={st === 'caught' ? 4 : st === 'hit' ? 3.4 : playable ? 2.4 : 1.6} className="star-core" />
                {(st !== 'unseen' || hover === s.id) && (
                  <text
                    x={s.x > W / 2 ? s.x - 9 : s.x + 9}
                    y={s.y - 9}
                    textAnchor={s.x > W / 2 ? 'end' : 'start'}
                    className="star-label"
                  >
                    {shortName(s.mission)}
                  </text>
                )}
              </a>
            );
          })}
        </svg>
        <p className="sky-hover" aria-live="polite">
          {hov ? <>{hov.mission} &middot; {hov.year} &middot; {hov.sub.replace(/_/g, ' ')}</> : <>&nbsp;</>}
        </p>
      </div>

      <section className="sky-stats">
        <div className="stat big">
          <span className="stat-label">Caught before launch</span>
          <span className="stat-num">{rate === null ? 'None yet' : pct(rate * 100)}</span>
          <span className="stat-sub">{rate === null ? 'Fly a mission' : `${caughtN} of ${caughtN + missedN} · ${wrongN} wrong ${wrongN === 1 ? 'pin' : 'pins'} · ${runs.length} ${runs.length === 1 ? 'flight' : 'flights'}`}</span>
          <More label="how it is counted" className="why">
            {rate === null
              ? 'Fly a mission. Your rate is caught divided by caught plus missed plus wrong pins, over every flight.'
              : `${caughtN} caught out of ${caughtN + missedN} real ${caughtN + missedN === 1 ? 'failure' : 'failures'} that came for your craft, with ${wrongN} wrong ${wrongN === 1 ? 'pin' : 'pins'} counted against you, over ${runs.length} ${runs.length === 1 ? 'flight' : 'flights'}. Rate is caught divided by caught plus missed plus wrong pins.`}
          </More>
        </div>
        <div className="stat">
          <span className="stat-label">Streak</span>
          <span className="stat-num">{streak.count} <small>{streak.count === 1 ? 'day' : 'days'}</small></span>
          <span className="stat-sub">{streak.last ? `Last flight ${prettyDate(streak.last)}` : 'No flights yet'}</span>
        </div>
        <div className="stat" title={`${PLAYABLE_LESSONS.length} can strike in play; the rest are library reading.`}>
          <span className="stat-label">Stars</span>
          <span className="stat-num">{count('caught')} <small>bright</small> {count('hit')} <small className="alarm">red</small></span>
          <span className="stat-sub">{count('unseen')} of {LESSONS.length} not met &middot; {PLAYABLE_LESSONS.length} playable</span>
        </div>
        <div className="stat today">
          <span className="stat-label">Mission of the day</span>
          <span className="stat-num serif">{briefById(today.brief.id).title}</span>
          <button
            className="btn btn-primary btn-small"
            onClick={() => {
              startMission(today.brief.id, today.seed, true);
              go('/hangar');
            }}
          >
            {flownToday ? 'Fly it again' : 'Fly today’s mission'}
          </button>
        </div>
      </section>

      <div className="sky-more">
        <More label="Best flights" count={boards.length === 0 ? 0 : boards.reduce((x, y) => x + y.top.length, 0)}>
          {boards.length === 0 ? (
            <p className="best-empty">No flights on this device yet. Your best five per brief land here, with every crew turn flown on this screen.</p>
          ) : (
            <>
              <p className="best-note">
                Top five per brief, kept in this browser and nowhere else. Score is science percent, plus 15 for each real failure caught at review, minus 5 for each one missed, minus 5 for each pin on something with no real risk for that craft.
              </p>
              <div className="best-grid">
                {boards.map(({ brief, top }) => (
                  <div key={brief.id} className="best-board">
                    <p className="best-title">{brief.title}</p>
                    <ol className="best-list">
                      {top.map(({ r, score }, k) => (
                        <li key={r.at}>
                          <span className="b-rank">{two(k + 1)}</span>
                          <span className="b-who">{r.crew ?? 'Solo'}{r.refly ? ' (refly)' : ''}<em>{prettyDate(r.day)}</em></span>
                          <span className="b-sci">{pct(r.sciencePct)}<em>science</em></span>
                          <span className="b-caught">{n0(r.caught.length)}<em>caught</em></span>
                          <span className="b-score">{n0(score)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </>
          )}
        </More>

        {runs.length > 0 && (
          <More label="Flight log" count={Math.min(12, runs.length)}>
            <ol className="hist-list">
              {[...runs].reverse().slice(0, 12).map((r) => (
                <li key={r.at}>
                  <span className="h-day">{prettyDate(r.day)}</span>
                  <span className="h-brief">{(() => { try { return briefById(r.briefId).title; } catch { return r.briefId; } })()}{r.refly && ' (refly)'}{r.crew && ` · ${r.crew}`}</span>
                  <span className={'h-out o-' + r.outcome}>{r.outcome}</span>
                  <span className="h-sci">{pct(r.sciencePct)} science</span>
                  <span className="h-catch">{r.caught.length} caught &middot; {r.missed.length} missed</span>
                </li>
              ))}
            </ol>
          </More>
        )}
      </div>
    </div>
  );
}

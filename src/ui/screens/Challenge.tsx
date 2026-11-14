import { useMemo } from 'react';
import { briefById, partById, instrumentById, PROCESS_OPTIONS, lessonById, crewScore, SLOTS, launchOf, orbitOf, difficultyOf } from '../eng';
import { useGame } from '../store';
import { readFriend, splitShare } from '../share';
import { Craft3D } from '../Shell';
import { looksOf, instrumentLooks, SLOT_NAME } from '../craftLooks';
import { go, href } from '../router';
import { kg, usd, watts, pct, n0 } from '../format';
import { More } from '../parts/Bits';

export default function Challenge({ rest }: { rest: string }) {
  const startChallenge = useGame((s) => s.startChallenge);
  const { code, meta } = splitShare(rest);
  const friend = useMemo(() => {
    try {
      const f = readFriend(code, meta);
      if (f) briefById(f.design.briefId);
      return f;
    } catch {
      return null;
    }
  }, [code, meta]);

  if (!friend) {
    return (
      <div className="page empty-page">
        <p className="eyebrow">A friend&rsquo;s mission</p>
        <h1 className="page-title">This link lost its way.</h1>
        <p className="page-lede">
          The mission code in it does not match any craft we can build. It may have been cut short when it was pasted. Ask your friend to send it again, or start a mission of your own.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href={href('/brief')}>Start fresh</a>
        </div>
      </div>
    );
  }

  const brief = briefById(friend.design.briefId);
  const d = friend.design;
  const r = friend.result;
  const fly = (mode: 'same' | 'own') => {
    if (startChallenge(code, meta, mode)) go(mode === 'same' ? '/review' : '/hangar');
  };
  const procLabel = (id: string) => PROCESS_OPTIONS.find((o) => o.id === id)?.label ?? id;

  const ff = r?.falseFlags?.length ?? 0;
  return (
    <div className="page challenge">
      <header className="app-head">
        <div>
          <p className="eyebrow">{brief.title} &middot; a friend&rsquo;s mission &middot; seed {friend.seed}</p>
          <h1 className="app-title">Same seed. Same failures. Your call.</h1>
        </div>
        <More label="How challenges work" className="head-more">
          <p>
            Your friend flew this craft to {brief.target} on seed {friend.seed}. On this seed every real failure rolls the same dice for any craft, on the same days.
            Fly their exact craft and pin the risks yourself, or build your own and see whose holds up.
          </p>
        </More>
      </header>

      <div className="review-grid">
        <div className="review-left">
          <div className="craft-frame hero-frame">
            <Craft3D className="review-craft" looks={looksOf(d)} instruments={instrumentLooks(d)} lander={brief.kind === 'lander'} autoRotate />
            <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
            <span className="frame-label">Their craft &middot; seed {friend.seed}</span>
          </div>
        </div>

        <div className="review-right">
          {r ? (
            <div className="result-score">
              <span className="result-num">{pct(r.sciencePct)}</span>
              <span className="result-cap">science came home for them</span>
            </div>
          ) : (
            <p className="head-line">Their result was not in the link. Beat the craft instead.</p>
          )}
          {r && (
            <div className="stat-chips">
              <span><b>{n0(crewScore(r))}</b>score</span>
              <span><b>{n0(r.caught.length)}</b>caught</span>
              <span className={r.missed.length ? 'bad' : ''}><b>{n0(r.missed.length)}</b>missed</span>
              <span className={ff ? 'bad' : ''}><b>{n0(ff)}</b>wrong {ff === 1 ? 'pin' : 'pins'}</span>
            </div>
          )}
          {r && r.triggered.length > 0 && (
            <p className="head-chips">
              <span className="chip-k alarm">Hit by</span>
              {r.triggered.map((id) => <a key={id} className="chip chip-bad" href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>)}
            </p>
          )}
          <div className="cta-col">
            <button className="btn btn-primary" onClick={() => fly('same')}>Fly their exact craft</button>
            <button className="btn btn-ghost" onClick={() => fly('own')}>Build my own on this seed</button>
          </div>
          <p className="daily-note">Their pins stay hidden. You decide what will fail.</p>

          <More label="Their craft" count={`${kg(friend.report.massKg)} · ${usd(friend.report.costM)}`} className="spec-more">
            <ul className="spec-list">
              <li><span>Mass</span>{kg(friend.report.massKg)} of {kg(friend.report.massLimitKg)}</li>
              <li><span>Cost</span>{usd(friend.report.costM)} of {usd(friend.report.budgetM)}</li>
              <li><span>Power</span>{watts(friend.report.powerGenW)} at {brief.target}</li>
              <li><span>Rocket</span>{launchOf(d).name}</li>
              <li><span>{brief.kind === 'lander' ? 'Landing site' : brief.kind === 'flyby' ? 'Pass' : 'Orbit'}</span>{orbitOf(d).name}</li>
              <li><span>Difficulty</span>{difficultyOf(d).label}</li>
              {SLOTS.map((s) => (
                <li key={s}><span>{SLOT_NAME[s]}</span>{partById(d.parts[s])?.name}</li>
              ))}
              <li><span>Instruments</span>{d.instruments.map((i) => instrumentById(i)?.name).join(', ')}</li>
              {(['interfaceCheck', 'deployTest', 'faultSim', 'fuelMargin'] as const).map((p) => (
                <li key={p}><span>Process</span>{procLabel(d.process[p])}</li>
              ))}
            </ul>
          </More>
        </div>
      </div>
    </div>
  );
}

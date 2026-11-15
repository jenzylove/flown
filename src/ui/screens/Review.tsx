import { useMemo } from 'react';
import { reviewItems, evaluate, applyFixes, briefById, MAX_PINS, expectedScience } from '../eng';
import type { SlotId } from '../eng';
import { useGame } from '../store';
import { Craft3D } from '../Shell';
import { Rail } from '../parts/Rail';
import { More } from '../parts/Bits';
import { looksOf, instrumentLooks, SLOT_NAME } from '../craftLooks';
import { go, href } from '../router';
import { usd, days, sep } from '../format';
import { NoMission } from './NoMission';
import { useCoop, CoopStrip } from '../parts/Coop';
import { pinsFor } from '../coop';

export default function Review() {
  const mission = useGame((s) => s.mission);
  const toggleFlag = useGame((s) => s.toggleFlag);
  const setFix = useGame((s) => s.setFix);
  const launch = useGame((s) => s.launch);
  const setActive = useGame((s) => s.setActive);
  const voteGo = useGame((s) => s.voteGo);
  const coop = useCoop();

  const items = useMemo(() => (mission ? reviewItems(mission.design) : []), [mission]);
  const rep = useMemo(() => (mission ? evaluate(applyFixes(mission.design, mission.fixed)) : null), [mission]);
  if (!mission || !rep) return <NoMission />;
  const brief = briefById(mission.briefId);
  const { flagged, fixed, design } = mission;

  const pins = items
    .filter((it) => it.slot && flagged.includes(it.id))
    .map((it) => ({ slot: it.slot as SlotId, label: SLOT_NAME[it.slot as SlotId] }));

  const n = coop?.players.length ?? 0;
  const active = coop?.coop.active ?? 0;
  const quota = pinsFor(n);
  const pinOwner = coop?.coop.pinOwner ?? {};
  const pinsOf = (i: number) => flagged.filter((f) => (pinOwner[f] ?? 0) === i).length;
  const me = coop ? coop.players[active] : null;
  const myLeft = coop ? Math.max(0, (quota[active] ?? 0) - pinsOf(active)) : 0;
  const full = coop ? myLeft === 0 : flagged.length >= MAX_PINS;
  const FULL_WHY = coop && me
    ? `${me.name} has used every pin. Unpin one, or pass the device.`
    : `All ${MAX_PINS} pins are used. Unpin one to pin something else.`;
  const votes = coop?.coop.go ?? [];
  const allGo = !!coop && votes.every((v) => v === true);
  const noGo = coop ? coop.players.filter((_, i) => votes[i] === false).map((p) => p.name) : [];
  const pick = (slot: SlotId) => toggleFlag(`part:${slot}`);
  const fixBlocked = (id: string) => {
    if (fixed.includes(id)) return null;
    const next = evaluate(applyFixes(design, [...fixed, id]));
    return next.costM > next.budgetM ? 'Not enough budget left' : next.blockers.length > rep.blockers.length ? next.blockers[0] : null;
  };
  const left = rep.budgetM - rep.costM;
  const partItems = items.filter((i) => i.id.startsWith('part:'));
  const procItems = items.filter((i) => i.id.startsWith('process:'));

  const doLaunch = () => {
    launch();
    go('/flight');
  };

  const renderItem = (it: (typeof items)[number]) => {
    const on = flagged.includes(it.id);
    const isFixed = fixed.includes(it.id);
    const theirs = coop && on && (pinOwner[it.id] ?? 0) !== active ? coop.players[pinOwner[it.id] ?? 0]?.name : null;
    const why = fixBlocked(it.id);
    return (
      <li key={it.id} className={'rv-item' + (on ? ' pinned' : '')}>
        <button className="rv-pin" onClick={() => toggleFlag(it.id)} aria-pressed={on} disabled={(!on && full) || !!theirs} title={!on && full ? FULL_WHY : undefined}>
          <span className="pin-glyph" aria-hidden="true" />
          <span className="rv-label">{it.label}</span>
          <span className="rv-state">{on ? (coop ? `${coop.players[pinOwner[it.id] ?? 0]?.name}’s pin` : 'Pinned') : 'Pin'}</span>
        </button>
        {on && it.fix && (
          <div className="rv-fix">
            <svg className="leader" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 0 V14 H24" /></svg>
            <div className="rv-fix-body">
              <p className="rv-fix-label">{it.fix.label}</p>
              <span className="rv-fix-cost">{usd(it.fix.costM)}{it.fix.scheduleDays > 0 && <> &middot; {days(it.fix.scheduleDays)}</>}</span>
              <button
                className={'btn btn-small ' + (isFixed ? 'btn-on' : 'btn-ghost')}
                disabled={!isFixed && !!why}
                onClick={() => setFix(it.id, !isFixed)}
              >
                {isFixed ? 'Fix bought' : 'Pay for the fix'}
              </button>
              {!isFixed && why && <p className="rv-why">{sep(why)}</p>}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="page review">
      <header className="app-head">
        <div>
          <p className="eyebrow">{coop ? 'One craft' : 'Step 3 of 4'} &middot; Pre launch review &middot; {brief.title}</p>
          <h1 className="app-title">What will fail?</h1>
          <p className="head-line">
            {coop && me
              ? `${me.name} pins now: ${myLeft} of ${quota[active]} left. Fixes come out of the shared budget.`
              : `Pin up to ${MAX_PINS} risks. Fix the ones you believe in.`}
          </p>
        </div>
        <More label="How pins work" className="head-more">
          <p>
            Tap the parts on the craft, or the items in the list, to pin what worries you. You get {MAX_PINS} pins. A pin counts as caught only if that thing really goes wrong,
            and a pin on something with no real risk for your craft counts against your catch rate. Pay to fix the pins you believe in.
          </p>
          {coop && <p>In a crew, the {MAX_PINS} pins are split by role. A catch is credited to the player whose pin made it. The craft launches only when every player calls GO.</p>}
        </More>
      </header>

      {coop && (
        <CoopStrip
          crew={coop}
          label="Who is pinning"
          onPick={setActive}
          state={(i) => ({ text: `${pinsOf(i)} of ${quota[i]} ${quota[i] === 1 ? 'pin' : 'pins'}` })}
        />
      )}

      <div className="review-grid">
        <div className="review-left">
          <div className="craft-frame hero-frame">
            <Craft3D className="review-craft" looks={looksOf(design)} instruments={instrumentLooks(design)} pins={pins} onPick={pick} lander={brief.kind === 'lander'} autoRotate={pins.length === 0} />
            <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
            <span className="frame-label">{full ? (coop && me ? `${me.name} has no pins left` : `All ${MAX_PINS} pins used`) : coop && me ? `${me.name}, tap a part to pin it` : 'Tap a part to pin it'}</span>
          </div>
        </div>

        <div className="review-right">
          <div className="rv-tally" aria-live="polite">
            <span className="rv-big"><b>{flagged.length}</b><small>of {MAX_PINS} pins</small></span>
            <span className={'rv-big' + (left < 0 ? ' bad' : '')}><b>{usd(Math.max(0, left))}</b><small>left</small></span>
            <span className="rv-big rv-fixed"><b>{fixed.length}</b><small>fixed</small></span>
            <span className="pin-dots" aria-hidden="true">
              {Array.from({ length: MAX_PINS }, (_, k) => <i key={k} className={k < flagged.length ? 'on' : ''} />)}
            </span>
          </div>
          {full && <p className="rv-why" role="status">{FULL_WHY}</p>}
          <p className="mono-label">Hardware</p>
          <ul className="rv-list">{partItems.map(renderItem)}</ul>
          <p className="mono-label">Process</p>
          <ul className="rv-list">{procItems.map(renderItem)}</ul>

          <More label="Resources after fixes" className="rv-more">
            <Rail report={rep} compact science={expectedScience(applyFixes(mission.design, mission.fixed))} />
          </More>
          {rep.blockers.length > 0 && (
            <ul className="blockers">
              {rep.blockers.map((b) => <li key={b}><span className="blk-mark" aria-hidden="true" />{sep(b)}</li>)}
            </ul>
          )}
          {coop && (
            <div className="go-poll" role="group" aria-label="GO or NO GO">
              <p className="mono-label">GO / NO GO &middot; tap your name</p>
              <div className="go-row">
                {coop.players.map((p, i) => {
                  const v = votes[i];
                  return (
                    <button
                      key={p.name}
                      className={'go-btn' + (v === true ? ' go' : v === false ? ' nogo' : '')}
                      onClick={() => voteGo(i, v !== true)}
                      aria-pressed={v === true}
                    >
                      <span className="go-name">{p.name}</span>
                      <span className="go-v">{v === true ? 'GO' : v === false ? 'NO GO' : 'Poll'}</span>
                    </button>
                  );
                })}
              </div>
              {noGo.length > 0 && <p className="rv-why" role="status">{noGo.join(' and ')} {noGo.length === 1 ? 'calls' : 'call'} NO GO. Talk it through, change the plan, poll again.</p>}
            </div>
          )}
          <div className="cta-row rv-cta">
            <a className="btn btn-ghost" href={href(mission.attempt > 1 ? '/refly' : '/hangar')}>Hangar</a>
            <button className="btn btn-primary btn-launch" disabled={rep.blockers.length > 0 || (!!coop && !allGo)} onClick={doLaunch}>
              {coop && !allGo ? `Launch needs ${n} GO` : 'Launch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

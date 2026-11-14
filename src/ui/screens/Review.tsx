import { useMemo } from 'react';
import { reviewItems, evaluate, applyFixes, briefById, MAX_PINS } from '../eng';
import type { SlotId } from '../eng';
import { useGame } from '../store';
import { Craft3D } from '../Shell';
import { Rail } from '../parts/Rail';
import { looksOf, instrumentLooks, SLOT_NAME } from '../craftLooks';
import { go, href } from '../router';
import { usd, days } from '../format';
import { NoMission } from './NoMission';

export default function Review() {
  const mission = useGame((s) => s.mission);
  const toggleFlag = useGame((s) => s.toggleFlag);
  const setFix = useGame((s) => s.setFix);
  const launch = useGame((s) => s.launch);

  const items = useMemo(() => (mission ? reviewItems(mission.design) : []), [mission]);
  const rep = useMemo(() => (mission ? evaluate(applyFixes(mission.design, mission.fixed)) : null), [mission]);
  if (!mission || !rep) return <NoMission />;
  const brief = briefById(mission.briefId);
  const { flagged, fixed, design } = mission;

  const pins = items
    .filter((it) => it.slot && flagged.includes(it.id))
    .map((it) => ({ slot: it.slot as SlotId, label: SLOT_NAME[it.slot as SlotId] }));

  const full = flagged.length >= MAX_PINS;
  const FULL_WHY = `All ${MAX_PINS} pins are used. Unpin one to pin something else.`;
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
    const why = fixBlocked(it.id);
    return (
      <li key={it.id} className={'rv-item' + (on ? ' pinned' : '')}>
        <button className="rv-pin" onClick={() => toggleFlag(it.id)} aria-pressed={on} disabled={!on && full} title={!on && full ? FULL_WHY : undefined}>
          <span className="pin-glyph" aria-hidden="true" />
          <span className="rv-label">{it.label}</span>
          <span className="rv-state">{on ? 'Pinned' : 'Pin'}</span>
        </button>
        {on && it.fix && (
          <div className="rv-fix">
            <svg className="leader" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 0 V14 H24" /></svg>
            <div className="rv-fix-body">
              <p className="rv-fix-label">{it.fix.label}</p>
              <p className="rv-fix-cost">{usd(it.fix.costM)}{it.fix.scheduleDays > 0 && <> &middot; {days(it.fix.scheduleDays)}</>}</p>
              <button
                className={'btn btn-small ' + (isFixed ? 'btn-on' : 'btn-ghost')}
                disabled={!isFixed && !!why}
                onClick={() => setFix(it.id, !isFixed)}
              >
                {isFixed ? 'Fix bought' : 'Pay for the fix'}
              </button>
              {!isFixed && why && <p className="rv-why">{why}</p>}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="page review">
      <header className="page-head">
        <p className="eyebrow">Step 3 of 4 &middot; Pre launch review &middot; {brief.title}</p>
        <h1 className="page-title">What will fail?</h1>
        <p className="page-lede">
          Tap the parts on the craft, or the items below, to pin what worries you. You get {MAX_PINS} pins. A pin counts as caught only if that thing really goes wrong,
          and a pin on something with no real risk for your craft counts against your catch rate. Pay to fix the pins you believe in.
        </p>
      </header>

      <div className="review-grid">
        <div className="review-left">
          <div className="craft-frame">
            <Craft3D className="review-craft" looks={looksOf(design)} instruments={instrumentLooks(design)} pins={pins} onPick={pick} lander={brief.kind === 'lander'} autoRotate={pins.length === 0} />
            <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
            <span className="frame-label">{full ? `All ${MAX_PINS} pins used` : 'Tap a part to pin it'}</span>
          </div>
          <div className="review-tally">
            <span><b>{flagged.length}</b> of {MAX_PINS} pins</span>
            <span><b>{fixed.length}</b> fixed</span>
            <span className={left < 0 ? 'bad' : ''}><b>{usd(Math.max(0, left))}</b> budget left</span>
          </div>
        </div>

        <div className="review-right">
          {full && <p className="rv-why" role="status">{FULL_WHY}</p>}
          <p className="mono-label">Hardware</p>
          <ul className="rv-list">{partItems.map(renderItem)}</ul>
          <p className="mono-label">Process</p>
          <ul className="rv-list">{procItems.map(renderItem)}</ul>

          <Rail report={rep} compact />
          {rep.blockers.length > 0 && (
            <ul className="blockers">
              {rep.blockers.map((b) => <li key={b}><span className="blk-mark" aria-hidden="true" />{b}</li>)}
            </ul>
          )}
          <div className="cta-row">
            <a className="btn btn-ghost" href={href(mission.attempt > 1 ? '/refly' : '/hangar')}>Back to the hangar</a>
            <button className="btn btn-primary btn-launch" disabled={rep.blockers.length > 0} onClick={doLaunch}>
              Launch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { PARTS, INSTRUMENTS, PROCESS_OPTIONS, SLOTS, evaluate, briefById, lessonById } from '../eng';
import type { ProcessId, SlotId } from '../eng';
import { useGame } from '../store';
import { Craft3D } from '../Shell';
import { Rail } from '../parts/Rail';
import { looksOf, instrumentLooks, SLOT_NAME } from '../craftLooks';
import { go, href } from '../router';
import { kg, usd, watts, mb, two, days } from '../format';
import { NoMission } from './NoMission';

const PROCESS_NAME: Record<ProcessId, string> = {
  interfaceCheck: 'Interface check',
  deployTest: 'Deployment test',
  faultSim: 'Fault simulation',
  fuelMargin: 'Fuel margin',
};
const PROCESSES: ProcessId[] = ['interfaceCheck', 'deployTest', 'faultSim', 'fuelMargin'];

type Tab = SlotId | 'instruments' | 'process';

export default function Hangar({ refly }: { refly?: boolean }) {
  const mission = useGame((s) => s.mission);
  const crew = useGame((s) => s.crew);
  const setPart = useGame((s) => s.setPart);
  const toggleInstrument = useGame((s) => s.toggleInstrument);
  const setProcess = useGame((s) => s.setProcess);
  const firstGlow = mission?.refly?.slots[0];
  const [tab, setTab] = useState<Tab>(refly && firstGlow ? firstGlow : 'power');

  const report = useMemo(() => (mission ? evaluate(mission.design) : null), [mission]);
  if (!mission || !report) return <NoMission />;
  const brief = briefById(mission.briefId);
  const d = mission.design;
  const glow = mission.refly?.slots ?? [];
  const tabs: Tab[] = [...SLOTS, 'instruments', 'process'];
  const tabName = (t: Tab) => (t === 'instruments' ? 'Instruments' : t === 'process' ? 'Process' : SLOT_NAME[t]);
  const tabValue = (t: Tab) => {
    if (t === 'instruments') return `${d.instruments.length} of ${brief.maxInstruments}`;
    if (t === 'process') return `${PROCESSES.length} choices`;
    return PARTS.find((p) => p.id === d.parts[t])?.name ?? '';
  };
  const ok = report.blockers.length === 0;

  return (
    <div className="page hangar">
      <header className="page-head hangar-head">
        <p className="eyebrow">
          {mission.crewIndex !== undefined && crew?.players[mission.crewIndex] ? `${crew.players[mission.crewIndex].name}’s turn` : refly ? 'Refly' : mission.challenge ? 'A friend’s seed' : 'Step 2 of 4'} &middot; Hangar &middot; {brief.title}
        </p>
        <h1 className="page-title">{refly ? 'Same seed. Prove the fix.' : 'Build the craft.'}</h1>
        {refly && mission.refly && mission.refly.lessons.length > 0 ? (
          <p className="page-lede">
            The parts that failed are glowing. The same failures are waiting on the same days. Lessons in play:{' '}
            {mission.refly.lessons.map((id, i) => (
              <span key={id}>
                {i > 0 && ', '}
                <a href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>
              </span>
            ))}
            .
          </p>
        ) : (
          <p className="page-lede">{brief.goal} <span className="dim">{brief.budgetNote}.</span></p>
        )}
      </header>

      <div className="hangar-grid">
        <div className="hangar-left">
          <div className="craft-frame">
            <Craft3D
              className="hangar-craft"
              looks={looksOf(d)}
              instruments={instrumentLooks(d)}
              highlight={tab !== 'instruments' && tab !== 'process' ? tab : null}
              glow={glow}
              lander={brief.kind === 'lander'}
            />
            <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
            <span className="frame-label">{brief.target} &middot; seed {mission.seed}</span>
          </div>
          <Rail report={report} />
        </div>

        <div className="hangar-right">
          <nav className="slot-tabs" aria-label="Systems">
            {tabs.map((t, i) => (
              <button key={t} className={'slot-tab' + (tab === t ? ' on' : '') + (glow.includes(t as SlotId) ? ' glow' : '')} onClick={() => setTab(t)}>
                <span className="st-no">{two(i + 1)}</span>
                <span className="st-name">{tabName(t)}</span>
                <span className="st-val">{tabValue(t)}</span>
              </button>
            ))}
          </nav>

          <section className="options" key={tab}>
            {tab !== 'instruments' && tab !== 'process' && (
              <ul className="opt-list">
                {PARTS.filter((p) => p.slot === tab).map((p) => {
                  const on = d.parts[tab] === p.id;
                  return (
                    <li key={p.id}>
                      <button className={'opt' + (on ? ' on' : '')} onClick={() => setPart(tab, p.id)} aria-pressed={on}>
                        <span className="opt-mark" aria-hidden="true" />
                        <span className="opt-name">{p.name}</span>
                        <span className="opt-blurb">{p.blurb}</span>
                        <span className="opt-specs">
                          <span>{kg(p.massKg)}</span>
                          <span>{usd(p.costM)}</span>
                          {p.powerW !== 0 && <span>{p.powerW > 0 ? `makes ${watts(p.powerW)} at Earth` : `uses ${watts(-p.powerW)}`}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === 'instruments' && (
              <>
                <p className="opt-hint">Choose up to {brief.maxInstruments}. Science only counts if the data gets home.</p>
                <ul className="opt-list">
                  {INSTRUMENTS.map((ins) => {
                    const on = d.instruments.includes(ins.id);
                    const full = !on && d.instruments.length >= brief.maxInstruments;
                    return (
                      <li key={ins.id}>
                        <button className={'opt check' + (on ? ' on' : '')} disabled={full} onClick={() => toggleInstrument(ins.id, brief.maxInstruments)} aria-pressed={on}>
                          <span className="opt-mark" aria-hidden="true" />
                          <span className="opt-name">{ins.name}</span>
                          <span className="opt-blurb">{ins.blurb}</span>
                          <span className="opt-specs">
                            <span>{kg(ins.massKg)}</span>
                            <span>{usd(ins.costM)}</span>
                            <span>uses {watts(ins.powerW)}</span>
                            <span>{mb(ins.dataMbDay)} a day</span>
                            <span>{ins.science} science</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {tab === 'process' && (
              <div className="proc">
                <p className="opt-hint">Tests cost money and time. Many real failures lived here.</p>
                {PROCESSES.map((p) => (
                  <fieldset key={p} className="proc-group">
                    <legend>{PROCESS_NAME[p]}</legend>
                    {PROCESS_OPTIONS.filter((o) => o.process === p).map((o) => {
                      const on = d.process[p] === o.id;
                      return (
                        <button key={o.id} className={'opt' + (on ? ' on' : '')} onClick={() => setProcess(p, o.id)} aria-pressed={on}>
                          <span className="opt-mark" aria-hidden="true" />
                          <span className="opt-name">{o.label}</span>
                          <span className="opt-blurb">{o.blurb}</span>
                          <span className="opt-specs">
                            <span>{usd(o.costM)}</span>
                            {o.scheduleDays > 0 && <span>{days(o.scheduleDays)}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
            )}
          </section>

          <section className="verdict" aria-live="polite">
            {report.blockers.length > 0 && (
              <ul className="blockers">
                {report.blockers.map((b) => (
                  <li key={b}><span className="blk-mark" aria-hidden="true" />{b}</li>
                ))}
              </ul>
            )}
            {report.warnings.length > 0 && (
              <ul className="warnings">
                {report.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <button className="btn btn-primary btn-wide" disabled={!ok} onClick={() => go('/review')}>
              {ok ? 'Go to the pre launch review' : `${report.blockers.length} ${report.blockers.length === 1 ? 'problem' : 'problems'} to solve first`}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

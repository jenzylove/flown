import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  PARTS, INSTRUMENTS, PROCESS_OPTIONS, SLOTS, LAUNCH_OPTIONS, REAL_CRAFT, evaluate, expectedScience, briefById, lessonById,
  launchOf, orbitOf, orbitOptionsFor, difficultyOf,
} from '../eng';
import type { Brief, ProcessId, SlotId } from '../eng';
import { useGame } from '../store';
import { Craft3D } from '../Shell';
import { Rail } from '../parts/Rail';
import { Icon, More } from '../parts/Bits';
import { looksOf, instrumentLooks, SLOT_NAME } from '../craftLooks';
import { go, href } from '../router';
import { kg, usd, watts, mb, days, hours, sep } from '../format';
import { NoMission } from './NoMission';
import { useCoop, CoopStrip } from '../parts/Coop';
import { ownerOfGroup, rolesFor, roleById, roleNames, roleOfGroup } from '../coop';

const PROCESS_NAME: Record<ProcessId, string> = {
  interfaceCheck: 'Interface check',
  deployTest: 'Deployment test',
  faultSim: 'Fault simulation',
  fuelMargin: 'Fuel margin',
};
const PROCESSES: ProcessId[] = ['interfaceCheck', 'deployTest', 'faultSim', 'fuelMargin'];

type Tab = SlotId | 'instruments' | 'process' | 'launch' | 'orbit';

/** What the orbit tab is called for each kind of mission. */
function orbitTabName(kind: Brief['kind']) {
  return kind === 'lander' ? 'Landing site' : kind === 'flyby' ? 'Pass' : 'Orbit';
}

const share = (mult: number) => Math.round(Math.abs(mult - 1) * 100);

/** One option row: name and two key numbers; the full detail only when chosen. */
function Opt({
  on, check, disabled, onClick, name, nums, blurb, specs, detail,
}: {
  on: boolean;
  check?: boolean;
  disabled?: boolean;
  onClick: () => void;
  name: string;
  nums: string[];
  blurb?: string;
  specs?: ReactNode;
  detail: 'full' | 'specs' | 'none';
}) {
  return (
    <button className={'opt' + (check ? ' check' : '') + (on ? ' on' : '')} disabled={disabled} onClick={onClick} aria-pressed={on} title={blurb}>
      <span className="opt-mark" aria-hidden="true" />
      <span className="opt-name">{name}</span>
      <span className="opt-nums">
        {nums.map((n) => <span key={n}>{n}</span>)}
      </span>
      {on && detail !== 'none' && (
        <span className="opt-detail">
          {detail === 'full' && blurb && <span className="opt-blurb">{blurb}</span>}
          {specs && <span className="opt-specs">{specs}</span>}
        </span>
      )}
    </button>
  );
}

export default function Hangar({ refly }: { refly?: boolean }) {
  const mission = useGame((s) => s.mission);
  const crew = useGame((s) => s.crew);
  const setPart = useGame((s) => s.setPart);
  const toggleInstrument = useGame((s) => s.toggleInstrument);
  const setProcess = useGame((s) => s.setProcess);
  const setLaunch = useGame((s) => s.setLaunch);
  const setOrbit = useGame((s) => s.setOrbit);
  const setActive = useGame((s) => s.setActive);
  const markReady = useGame((s) => s.markReady);
  const coop = useCoop();
  const n = coop?.players.length ?? 0;
  const active = coop?.coop.active ?? 0;
  const firstGlow = mission?.refly?.slots[0];
  const myFirst = (i: number): Tab => roleById(rolesFor(n)[i]?.[0] ?? 'lead').groups[0];
  const [tab, setTab] = useState<Tab>(coop ? myFirst(active) : refly && firstGlow ? firstGlow : 'power');
  // When the device changes hands, open the new holder's first system.
  useEffect(() => {
    if (coop) setTab(myFirst(active));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, !!coop]);

  const report = useMemo(() => (mission ? evaluate(mission.design) : null), [mission]);
  if (!mission || !report) return <NoMission />;
  const brief = briefById(mission.briefId);
  const real = REAL_CRAFT[brief.realCraft];
  const d = mission.design;
  const glow = mission.refly?.slots ?? [];
  const tabs: Tab[] = [...SLOTS, 'instruments', 'process', 'launch', 'orbit'];
  const tabName = (t: Tab) =>
    t === 'instruments' ? 'Instruments' : t === 'process' ? 'Process' : t === 'launch' ? 'Rocket' : t === 'orbit' ? orbitTabName(brief.kind) : SLOT_NAME[t];
  const tabValue = (t: Tab) => {
    if (t === 'instruments') return `${d.instruments.length} of ${brief.maxInstruments}`;
    if (t === 'process') return `${PROCESSES.length} choices`;
    if (t === 'launch') return launchOf(d).name;
    if (t === 'orbit') return orbitOf(d).name;
    return PARTS.find((p) => p.id === d.parts[t])?.name ?? '';
  };
  const isSlot = (t: Tab): t is SlotId => (SLOTS as string[]).includes(t);
  const std = evaluate({ ...d, launch: 'lv_standard' });
  const curOrbit = orbitOf(d);
  const arrivalWord = brief.kind === 'lander' ? 'landing' : brief.kind === 'flyby' ? 'flyby' : 'arrival';
  const ok = report.blockers.length === 0;
  const issues = report.blockers.length + report.warnings.length;
  const owner = (t: Tab) => (coop ? ownerOfGroup(n, t) : -1);
  const locked = (t: Tab) => !!coop && owner(t) !== active;
  const lockedTab = locked(tab);
  const me = coop ? coop.players[active] : null;
  const allReady = !!coop && coop.coop.ready.every(Boolean);
  const who = mission.crewIndex !== undefined && crew?.players[mission.crewIndex] ? `${crew.players[mission.crewIndex].name}’s turn` : refly ? 'Refly' : mission.challenge ? 'A friend’s seed' : 'Step 2 of 4';

  const hint =
    tab === 'instruments' ? `Choose up to ${brief.maxInstruments}. Science only counts if the data gets home.`
    : tab === 'launch' ? 'A bigger rocket lets the craft weigh more, and costs more. Flown’s limit is a simplified dry mass limit.'
    : tab === 'orbit'
      ? brief.kind === 'lander' ? 'Where to land. A better site means more science and a harder landing.'
        : brief.kind === 'flyby' ? 'How close to fly. Closer means sharper data and more risk.'
        : 'Where the craft works. It changes the science, the shadows and the link home.'
    : tab === 'process' ? 'Tests cost money and time. Many real failures lived here.'
    : null;

  return (
    <div className="page hangar">
      <header className="app-head">
        <div>
          <p className="eyebrow">{coop ? 'One craft' : who} &middot; {brief.title} &middot; {difficultyOf(d).label}</p>
          <h1 className="app-title">{coop && me ? <>{me.name}, <em>your turn.</em></> : refly ? 'Same seed. Prove the fix.' : 'Build the craft.'}</h1>
          {coop && <p className="head-line">{roleNames(rolesFor(n)[active] ?? [])}. Change your systems, then mark ready.</p>}
          {refly && mission.refly && mission.refly.lessons.length > 0 && (
            <p className="head-chips">
              <span className="chip-k">Failed parts glow</span>
              {mission.refly.lessons.map((id) => (
                <a key={id} className="chip chip-bad" href={href('/case/' + id)}>{lessonById(id)?.mission ?? id}</a>
              ))}
            </p>
          )}
        </div>
        <More label="Mission brief" className="head-more">
          {coop && <p><b>Mission lead</b> owns the objective, the budget, the rocket, the {orbitTabName(brief.kind).toLowerCase()} and the process choices.</p>}
          <p>{brief.goal}</p>
          <p className="dim">{brief.story}</p>
          <p className="dim">{brief.budgetNote}. Up to {brief.maxInstruments} instruments.{real ? ` Modeled on ${real.name}.` : ''}</p>
          {refly && <p className="dim">The parts that failed are glowing. The same failures are waiting on the same days.</p>}
        </More>
      </header>

      {coop && (
        <CoopStrip
          crew={coop}
          label="Pass the device"
          onPick={setActive}
          state={(i) => (coop.coop.ready[i] ? { text: 'Ready', tone: 'good' } : { text: i === active ? 'Building' : 'Not ready' })}
        />
      )}

      <div className="hangar-grid">
        <div className="hangar-left">
          <div className="craft-frame hero-frame">
            <Craft3D
              className="hangar-craft"
              looks={looksOf(d)}
              instruments={instrumentLooks(d)}
              highlight={isSlot(tab) ? tab : null}
              glow={glow}
              lander={brief.kind === 'lander'}
            />
            <span className="frame-corner tl" /><span className="frame-corner tr" /><span className="frame-corner bl" /><span className="frame-corner br" />
            <span className="frame-label">{brief.target} &middot; seed {mission.seed}</span>
          </div>
          <Rail report={report} science={expectedScience(mission.design)} />
        </div>

        <div className="hangar-right">
          <nav className="slot-tabs" aria-label="Systems">
            {tabs.map((t) => (
              <button
                key={t}
                className={'slot-tab' + (tab === t ? ' on' : '') + (glow.includes(t as SlotId) ? ' glow' : '') + (locked(t) ? ' locked' : '')}
                onClick={() => setTab(t)}
                title={`${tabName(t)}: ${tabValue(t)}${coop ? ` · ${coop.players[owner(t)]?.name}` : ''}`}
                aria-pressed={tab === t}
              >
                <Icon name={t} />
                <span className="st-name">{tabName(t)}</span>
              </button>
            ))}
          </nav>

          <div className="opt-head">
            <span className="opt-head-k">{tabName(tab)}</span>
            <span className="opt-head-v">{tabValue(tab)}</span>
            {hint && <More label="why" className="why">{hint}</More>}
          </div>
          {coop && (
            <p className={'lock-line' + (lockedTab ? ' on' : '')}>
              {lockedTab
                ? <>Locked &middot; {coop.players[owner(tab)]?.name} owns this ({roleOfGroup(n, tab).name})</>
                : <>Yours &middot; {roleOfGroup(n, tab).name}</>}
            </p>
          )}

          <section className={'options' + (lockedTab ? ' is-locked' : '')} key={tab} inert={lockedTab || undefined}>
            {isSlot(tab) && (
              <ul className="opt-list">
                {PARTS.filter((p) => p.slot === tab).map((p) => {
                  const on = d.parts[tab] === p.id;
                  const pw = p.powerW !== 0 ? (p.powerW > 0 ? `makes ${watts(p.powerW)} at Earth` : `uses ${watts(-p.powerW)}`) : null;
                  return (
                    <li key={p.id}>
                      <Opt
                        on={on}
                        onClick={() => setPart(tab, p.id)}
                        name={p.name}
                        nums={tab === 'power' && p.powerW > 0 ? [`${watts(p.powerW)}`, usd(p.costM)] : [kg(p.massKg), usd(p.costM)]}
                        blurb={p.blurb}
                        detail="full"
                        specs={<><span>{kg(p.massKg)}</span><span>{usd(p.costM)}</span>{pw && <span>{pw}</span>}</>}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === 'instruments' && (
              <ul className="opt-list">
                {INSTRUMENTS.map((ins) => {
                  const on = d.instruments.includes(ins.id);
                  const full = !on && d.instruments.length >= brief.maxInstruments;
                  return (
                    <li key={ins.id}>
                      <Opt
                        on={on}
                        check
                        disabled={full}
                        onClick={() => toggleInstrument(ins.id, brief.maxInstruments)}
                        name={ins.name}
                        nums={[`${ins.science} sci`, usd(ins.costM)]}
                        blurb={ins.blurb}
                        detail="full"
                        specs={<><span>{kg(ins.massKg)}</span><span>uses {watts(ins.powerW)}</span><span>{mb(ins.dataMbDay)} a day</span><span>{ins.science} science</span></>}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === 'launch' && (
              <ul className="opt-list">
                {LAUNCH_OPTIONS.map((o) => {
                  const on = launchOf(d).id === o.id;
                  const rep = evaluate({ ...d, launch: o.id });
                  const delta = rep.costM - std.costM;
                  return (
                    <li key={o.id}>
                      <Opt
                        on={on}
                        onClick={() => setLaunch(o.id)}
                        name={o.name}
                        nums={[`${kg(rep.massLimitKg)} dry`, delta === 0 ? 'no extra' : delta > 0 ? `+${usd(delta)}` : `saves ${usd(-delta)}`]}
                        blurb={o.blurb}
                        detail="full"
                        specs={<><span>allows {kg(rep.massLimitKg)} dry</span><span>{delta === 0 ? 'no extra cost' : delta > 0 ? `costs ${usd(delta)} more` : `saves ${usd(-delta)}`}</span></>}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === 'orbit' && (
              <ul className="opt-list">
                {orbitOptionsFor(brief.id).map((o) => {
                  const on = curOrbit.id === o.id;
                  const rep = evaluate({ ...d, orbit: o.id });
                  const sci = o.scienceMult === 1 ? 'standard science' : `${o.scienceMult > 1 ? '+' : '−'}${share(o.scienceMult)}% science`;
                  const risk = o.arrivalRiskMult === 1 ? 'standard risk' : `${o.arrivalRiskMult > 1 ? '+' : '−'}${share(o.arrivalRiskMult)}% risk`;
                  return (
                    <li key={o.id}>
                      <Opt
                        on={on}
                        onClick={() => setOrbit(o.id)}
                        name={o.name}
                        nums={[sci, risk]}
                        blurb={o.blurb}
                        detail="full"
                        specs={
                          <>
                            <span>{o.scienceMult === 1 ? 'standard science' : `${share(o.scienceMult)}% ${o.scienceMult > 1 ? 'more' : 'less'} science`}</span>
                            {rep.eclipseHours > 0 && <span>{hours(rep.eclipseHours)} of shadow {brief.kind === 'lander' ? 'a night' : 'a lap'}</span>}
                            {o.linkMult !== 1 && <span>sends {mb(rep.downlinkMbDay)} a day</span>}
                            {o.arrivalRiskMult !== 1 && (
                              <span>{arrivalWord} failures {share(o.arrivalRiskMult)}% {o.arrivalRiskMult > 1 ? 'more' : 'less'} likely</span>
                            )}
                          </>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === 'process' && (
              <div className="proc">
                {PROCESSES.map((p) => {
                  const cur = PROCESS_OPTIONS.find((o) => o.process === p && o.id === d.process[p]);
                  return (
                    <fieldset key={p} className="proc-group">
                      <legend>{PROCESS_NAME[p]}</legend>
                      <div className="proc-row">
                        {PROCESS_OPTIONS.filter((o) => o.process === p).map((o) => {
                          const on = d.process[p] === o.id;
                          return (
                            <button key={o.id} className={'opt proc-opt' + (on ? ' on' : '')} onClick={() => setProcess(p, o.id)} aria-pressed={on} title={o.blurb}>
                              <span className="opt-mark" aria-hidden="true" />
                              <span className="opt-name">{o.label}</span>
                              <span className="opt-nums">
                                <span>{usd(o.costM)}</span>
                                {o.scheduleDays > 0 && <span>{days(o.scheduleDays)}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {cur && <p className="proc-blurb">{cur.blurb}</p>}
                    </fieldset>
                  );
                })}
              </div>
            )}
          </section>

          <section className="verdict" aria-live="polite">
            {issues > 0 && (
              <More
                label={report.blockers.length > 0 ? `${report.blockers.length} to fix` : `${issues} ${issues === 1 ? 'warning' : 'warnings'}`}
                count={report.blockers.length > 0 && report.warnings.length > 0 ? `+${report.warnings.length}` : undefined}
                tone={report.blockers.length > 0 ? 'bad' : undefined}
                className="issues"
              >
                {report.blockers.length > 0 && (
                  <ul className="blockers">
                    {report.blockers.map((b) => (
                      <li key={b}><span className="blk-mark" aria-hidden="true" />{sep(b)}</li>
                    ))}
                  </ul>
                )}
                {report.warnings.length > 0 && (
                  <ul className="warnings">
                    {report.warnings.map((w) => <li key={w}>{sep(w)}</li>)}
                  </ul>
                )}
              </More>
            )}
            {coop && me ? (
              allReady && ok ? (
                <button className="btn btn-primary btn-wide" onClick={() => go('/review')}>Everyone is ready. Pre launch review</button>
              ) : (
                <button
                  className="btn btn-primary btn-wide"
                  disabled={!ok || coop.coop.ready[active]}
                  onClick={() => {
                    markReady();
                    const c = useGame.getState().crew;
                    if (c?.coop?.ready.every(Boolean)) go('/review');
                  }}
                >
                  {!ok
                    ? `${report.blockers.length} ${report.blockers.length === 1 ? 'problem' : 'problems'} to solve first`
                    : coop.coop.ready[active] ? `${me.name} is ready. Pass the device` : `${me.name} is ready`}
                </button>
              )
            ) : (
              <button className="btn btn-primary btn-wide" disabled={!ok} onClick={() => go('/review')}>
                {ok ? 'Pre launch review' : `${report.blockers.length} ${report.blockers.length === 1 ? 'problem' : 'problems'} to solve first`}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

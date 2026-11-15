import type { Brief, BudgetReport, Design, FailureAnim, FlightEvent, ReviewItem, SlotId } from './types';

export interface Ctx {
  design: Design;
  brief: Brief;
  report: BudgetReport;
  part: (slot: SlotId) => string;
  proc: (p: keyof Design['process']) => string;
}

export type Effect =
  | { kind: 'lost' }
  | { kind: 'degrade'; mult: number }
  | { kind: 'save' }
  /** An unknown outcome: the seed decides between ok and fail. Used where history does not tell us what would have happened. */
  | { kind: 'gamble'; pFail: number; fail: Effect; ok: Effect; failText: string; okText: string };

export interface CrisisRule {
  prompt: string;
  options: {
    id: string;
    label: string;
    /** true when available, or a plain reason tied to the design when not. */
    available: (c: Ctx) => true | string;
    effect: Effect;
    after: string; // what happens to the craft
  }[];
  nasaChoice: string;
  nasaLabel: string; // what NASA did, short
}

export interface Rule {
  lessonId: string;
  item: string; // review item id that catches it
  phase: FlightEvent['phase'];
  /** probability this failure happens on this design (0 = cannot happen) */
  p: (c: Ctx) => number;
  text: string;
  anim: FailureAnim;
  effect?: Effect;     // when there is no crisis
  crisis?: CrisisRule; // the player decides
}

const isOrbiterLike = (c: Ctx) => c.brief.kind === 'orbiter';
const longMission = (c: Ctx) => c.brief.missionDays >= 1200;

export const REVIEW_FIXES: Record<string, ReviewItem['fix']> = {
  'part:power': { label: 'Test the panels on the assembled craft and add a spare power path', costM: 10, scheduleDays: 20 },
  'part:battery': { label: 'Size the battery for the longest shadow and check safe mode pointing for heat', costM: 6, scheduleDays: 10 },
  'part:antenna': { label: 'Flight like deployment test of the dish, plus a backup plan for data', costM: 18, scheduleDays: 40 },
  'part:attitude': { label: 'Add a spare and write a plan for losing wheels', costM: 8, scheduleDays: 10 },
  'part:propulsion': { label: 'Redundant valves and a retest of every pressure line', costM: 12, scheduleDays: 20 },
  'part:computer': { label: 'Keep workload margin and test the switch to the backup brain', costM: 6, scheduleDays: 15 },
  'part:thermal': { label: 'Run a thermal check on every fault mode', costM: 5, scheduleDays: 10 },
  'part:instruments': { label: 'Cross check instrument tests with an independent tool', costM: 8, scheduleDays: 20 },
  'process:interfaceCheck': { label: 'Push real data through every team, checking units both ways', costM: 18, scheduleDays: 60 },
  'process:deployTest': { label: 'Unfold every moving part on the finished craft', costM: 22, scheduleDays: 50 },
  'process:faultSim': { label: 'Simulate glitches, odd timings and overloads before launch', costM: 22, scheduleDays: 55 },
  'process:fuelMargin': { label: 'Carry a reserve and plan a use for leftover tank gas', costM: 5, scheduleDays: 0 },
};

export const RULES: Rule[] = [
  {
    lessonId: 'galileo-hga-stuck-ribs', item: 'part:antenna', phase: 'cruise', anim: 'antenna_jam',
    p: c => c.part('antenna') !== 'hga_deployable' ? 0 : c.proc('deployTest') === 'dt_full' ? 0.05 : c.proc('deployTest') === 'dt_part' ? 0.3 : 0.6,
    text: 'The umbrella dish opened part way and stuck. Only the low gain antenna can talk to Earth.',
    crisis: {
      prompt: 'Your big dish is stuck half open. What now?',
      options: [
        { id: 'compress', label: 'Rewrite the software to squeeze data through the small antenna', available: () => true, effect: { kind: 'degrade', mult: 0.6 }, after: 'New compression software sends the most important data through the small antenna.' },
        { id: 'shake', label: 'Keep heating, cooling and hammering the dish to free it', available: () => true, effect: { kind: 'degrade', mult: 0.3 }, after: 'Months of tries. The ribs stay stuck and science waits.' },
      ],
      nasaChoice: 'compress', nasaLabel: 'NASA tried to free the dish for years, then flew the mission on the low gain antenna with new compression software.',
    },
  },
  {
    lessonId: 'mgs-1997-solar-array', item: 'part:power', phase: 'arrival', anim: 'panel_stuck',
    p: c => c.part('power') !== 'panel_wings' || c.brief.target !== 'Mars' ? 0 : c.proc('deployTest') === 'dt_full' ? 0.03 : c.proc('deployTest') === 'dt_part' ? 0.15 : 0.3,
    text: 'A solar wing did not latch fully. Braking in the thin air would bend it, so the plan slows down.',
    effect: { kind: 'degrade', mult: 0.85 },
  },
  {
    lessonId: 'lucy-solar-array-latch', item: 'part:power', phase: 'cruise', anim: 'panel_stuck',
    p: c => c.part('power') !== 'panel_wings' || c.brief.target === 'Mars' ? 0 : c.proc('deployTest') === 'dt_full' ? 0.03 : c.proc('deployTest') === 'dt_part' ? 0.15 : 0.3,
    text: 'One solar wing unfolded but did not lock. It gives power, but carefully.',
    effect: { kind: 'degrade', mult: 0.9 },
  },
  {
    lessonId: 'kepler-reaction-wheels', item: 'part:attitude', phase: 'operations', anim: 'wheel_fail',
    p: c => !longMission(c) || c.part('propulsion') === 'ion' || c.brief.kind === 'lander' ? 0 : c.part('attitude') === 'wheels_3' ? 0.5 : 0.12,
    text: 'A reaction wheel stopped, then another. The craft cannot hold steady any more.',
    crisis: {
      prompt: 'Two wheels are dead. The craft drifts. What now?',
      options: [
        { id: 'end', label: 'End the mission', available: () => true, effect: { kind: 'degrade', mult: 0.55 }, after: 'The mission ends early with the data it has.' },
        { id: 'sunlight', label: 'Balance the craft against the push of sunlight on its panels', available: c => ['panel_large', 'panel_wings'].includes(c.part('power')) ? true : 'Your panels are too small to balance against sunlight.', effect: { kind: 'degrade', mult: 0.82 }, after: 'Sunlight becomes the third wheel. A new, smaller mission begins.' },
        { id: 'thrusters', label: 'Point with thrusters instead', available: c => c.part('attitude') === 'wheels_hybrid' && c.proc('fuelMargin') !== 'fm_0' ? true : 'You need thrusters for pointing and spare fuel.', effect: { kind: 'degrade', mult: 0.75 }, after: 'Thrusters hold the aim while the fuel lasts.' },
      ],
      nasaChoice: 'sunlight', nasaLabel: 'Engineers used sunlight pressure on the solar arrays as a stand in wheel. NASA approved the new K2 mission in May 2014.',
    },
  },
  {
    lessonId: 'dawn-reaction-wheels', item: 'part:attitude', phase: 'operations', anim: 'wheel_fail',
    p: c => c.part('propulsion') !== 'ion' ? 0 : c.part('attitude') === 'wheels_3' ? 0.55 : 0.2,
    text: 'Reaction wheels are failing one by one. Pointing now costs thruster fuel.',
    crisis: {
      prompt: 'Your wheels are failing. Thrusters can point the craft, but fuel is limited.',
      options: [
        { id: 'end', label: 'Stop science and save the craft', available: () => true, effect: { kind: 'degrade', mult: 0.5 }, after: 'The craft is safe and quiet.' },
        { id: 'ration', label: 'Point with thrusters and ration every gram of fuel', available: c => c.part('attitude') === 'wheels_hybrid' || c.proc('fuelMargin') !== 'fm_0' ? true : 'You have no thrusters for pointing and no spare fuel.', effect: { kind: 'degrade', mult: 0.85 }, after: 'Careful rationing keeps science going for years.' },
      ],
      nasaChoice: 'ration', nasaLabel: 'Dawn flew on a mix of wheels and hydrazine, rationed carefully, until the hydrazine ran out in 2018.',
    },
  },
  {
    lessonId: 'juno-helium-check-valves', item: 'part:propulsion', phase: 'arrival', anim: 'valve_stick',
    p: c => c.part('propulsion') === 'biprop' && isOrbiterLike(c) && c.brief.deltaVNeed === 'high' ? 0.45 : 0,
    text: 'Two helium valves opened slowly before the burn into the science orbit.',
    crisis: {
      prompt: 'Your engine valves are acting up before the big burn. Fire or stay?',
      options: [
        { id: 'burn', label: 'Fire the engine anyway', available: () => true, effect: { kind: 'gamble', pFail: 0.5, fail: { kind: 'degrade', mult: 0.4 }, ok: { kind: 'degrade', mult: 1 }, failText: 'The burn goes wrong and leaves the craft in an orbit nobody planned for. This is the outcome NASA feared; nobody knows if it would have happened.', okText: 'The burn works this time. NASA judged the same gamble not worth taking.' }, after: 'You fire the engine.' },
        { id: 'stay', label: 'Stay in the long orbit and do science from there', available: () => true, effect: { kind: 'degrade', mult: 0.75 }, after: 'Fewer close passes, but the craft is safe and the science keeps coming.' },
      ],
      nasaChoice: 'stay', nasaLabel: 'On February 17, 2017 NASA decided Juno would stay in its 53 day orbit.',
    },
  },
  {
    lessonId: 'mars-observer-loss', item: 'part:propulsion', phase: 'arrival', anim: 'signal_lost',
    p: c => c.part('propulsion') !== 'biprop' || c.brief.target !== 'Mars' ? 0 : 0.2,
    text: 'The craft began pressurizing its tanks before the orbit burn and was never heard from again. The probable cause was a leak in the propulsion lines.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'messenger-helium-pressurant', item: 'process:fuelMargin', phase: 'end', anim: 'engine_cutoff',
    p: c => isOrbiterLike(c) && c.proc('fuelMargin') === 'fm_0' && c.part('propulsion') !== 'ion' ? 0.75 : 0,
    text: 'The fuel is almost gone and the orbit is sinking.',
    crisis: {
      prompt: 'Your fuel is nearly gone. The orbit is decaying.',
      options: [
        { id: 'end', label: 'Let the craft fall now', available: () => true, effect: { kind: 'degrade', mult: 0.9 }, after: 'The mission ends a few weeks early.' },
        { id: 'helium', label: 'Vent the helium that pressurizes the tanks through the thrusters', available: c => ['biprop', 'mono_large', 'mono_small'].includes(c.part('propulsion')) ? true : 'Your engine has no pressurized tanks.', effect: { kind: 'degrade', mult: 0.96 }, after: 'The gas buys extra weeks of low, close science.' },
      ],
      nasaChoice: 'helium', nasaLabel: 'MESSENGER vented its helium pressurant as cold gas through its thrusters and kept flying until it struck Mercury on April 30, 2015.',
    },
  },
  {
    lessonId: 'mars-climate-orbiter-units', item: 'process:interfaceCheck', phase: 'arrival', anim: 'crash',
    p: c => !['orbiter', 'lander'].includes(c.brief.kind) ? 0 : c.proc('interfaceCheck') === 'ic_none' ? 0.5 : c.proc('interfaceCheck') === 'ic_spot' ? 0.12 : 0,
    text: 'One team sent thruster data in pounds, the other read it in newtons. The craft arrived far too low.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'mars-polar-lander-leg-signal', item: 'process:faultSim', phase: 'arrival', anim: 'crash',
    p: c => c.brief.kind !== 'lander' ? 0 : c.proc('faultSim') === 'fs_none' ? 0.5 : 0,
    text: 'The legs swung open and jolted a sensor. The software took it as touchdown and cut the engine high above the ground.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'schiaparelli-imu-saturation', item: 'process:faultSim', phase: 'arrival', anim: 'crash',
    p: c => c.brief.kind !== 'lander' ? 0 : c.proc('faultSim') === 'fs_full' ? 0.03 : 0.2,
    text: 'A spin sensor saturated for a second. The software believed it was below the ground and let go of the parachute.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'genesis-gswitch-orientation', item: 'process:interfaceCheck', phase: 'arrival', anim: 'crash',
    p: c => c.brief.kind !== 'lander' ? 0 : c.proc('interfaceCheck') === 'ic_none' ? 0.25 : 0,
    text: 'A deceleration sensor was installed the wrong way round. The parachute never got the signal.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'mgs-2006-battery-loss', item: 'process:faultSim', phase: 'operations', anim: 'battery_drain',
    p: c => c.brief.kind !== 'orbiter' || c.brief.eclipseFraction === 0 ? 0 : (c.proc('faultSim') === 'fs_full' ? 0.04 : c.proc('faultSim') === 'fs_basic' ? 0.15 : 0.3) * (c.part('thermal') === 'thermal_basic' ? 1.3 : 1),
    text: 'A bad memory upload drove a solar array against its stop. In safe mode the craft pointed a battery at the Sun, it overheated, and the power ran out.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'new-horizons-safe-mode', item: 'part:computer', phase: 'arrival', anim: 'signal_lost',
    p: c => c.brief.kind !== 'flyby' ? 0 : c.proc('faultSim') === 'fs_full' ? 0.15 : 0.5,
    text: 'Ten days before the flyby the computer overloaded and the craft went into safe mode.',
    crisis: {
      prompt: 'Safe mode, ten days before the only flyby you will ever get.',
      options: [
        { id: 'restore', label: 'Switch to the backup computer, rebuild the command plan and resume', available: c => c.part('computer') === 'cpu_dual' ? true : 'You have only one flight computer.', effect: { kind: 'degrade', mult: 0.99 }, after: 'Science resumes in days. Almost nothing is lost.' },
        { id: 'reboot', label: 'Reboot the single computer and rush the plan', available: () => true, effect: { kind: 'degrade', mult: 0.6 }, after: 'The reboot works, but part of the flyby plan is gone.' },
      ],
      nasaChoice: 'restore', nasaLabel: 'The craft switched to its backup computer; the team found no fault and resumed science on July 7. Under 1 percent of the planned science was lost.',
    },
  },
  {
    lessonId: 'voyager1-fds-memory', item: 'part:computer', phase: 'operations', anim: 'signal_lost',
    p: c => c.brief.missionDays < 3000 ? 0 : c.part('computer') === 'cpu_single' ? 0.3 : 0.05,
    text: 'A memory chip in a computer failed and the data coming home turned to gibberish.',
    effect: { kind: 'degrade', mult: 0.85 },
  },
  {
    lessonId: 'pathfinder-priority-inversion', item: 'process:faultSim', phase: 'operations', anim: 'signal_lost',
    p: c => c.brief.kind !== 'lander' ? 0 : c.proc('faultSim') === 'fs_none' ? 0.4 : c.proc('faultSim') === 'fs_basic' ? 0.1 : 0,
    text: 'The computer kept resetting itself on the surface. A low priority task was blocking a vital one.',
    effect: { kind: 'degrade', mult: 0.93 },
  },
  {
    lessonId: 'spirit-flash-memory', item: 'process:faultSim', phase: 'operations', anim: 'signal_lost',
    p: c => c.brief.kind !== 'lander' ? 0 : c.proc('faultSim') === 'fs_full' ? 0.03 : c.proc('faultSim') === 'fs_basic' ? 0.2 : 0.3,
    text: 'The memory filled with old files and the computer rebooted over and over.',
    effect: { kind: 'degrade', mult: 0.92 },
  },
  {
    lessonId: 'insight-dust-panels', item: 'part:power', phase: 'operations', anim: 'battery_drain',
    p: c => c.brief.kind !== 'lander' || c.part('power') === 'rtg' ? 0 : c.report.powerGenW < c.report.powerUseW * 2.2 ? 0.7 : 0.15,
    text: 'Dust settled on the solar panels year by year until there was not enough power to work.',
    effect: { kind: 'degrade', mult: 0.75 },
  },
  {
    lessonId: 'opportunity-dust-storm', item: 'part:power', phase: 'operations', anim: 'battery_drain',
    p: c => c.brief.kind !== 'lander' || c.part('power') === 'rtg' ? 0 : 0.2,
    text: 'A planet wide dust storm blocked the Sun. The batteries could not last until the sky cleared.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'lewis-safe-mode-spin', item: 'process:faultSim', phase: 'operations', anim: 'tumble',
    p: c => c.brief.kind !== 'telescope' ? 0 : c.proc('faultSim') === 'fs_none' ? 0.3 : c.proc('faultSim') === 'fs_basic' ? 0.1 : 0,
    text: 'The craft went into safe mode and began to spin. Its panels turned away from the Sun and the battery died.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'soho-loss-of-contact', item: 'process:faultSim', phase: 'operations', anim: 'tumble',
    p: c => c.brief.kind !== 'telescope' ? 0 : c.proc('faultSim') === 'fs_full' ? 0.03 : 0.2,
    text: 'A command sequence switched off a gyro the craft needed. It spun out of control and went silent for months.',
    effect: { kind: 'degrade', mult: 0.8 },
  },
  {
    lessonId: 'hubble-mirror-aberration', item: 'part:instruments', phase: 'operations', anim: 'none',
    p: c => !c.design.instruments.includes('telescope') ? 0 : c.proc('interfaceCheck') === 'ic_full' ? 0.05 : 0.3,
    text: 'The first images are blurry. The mirror was ground very precisely to the wrong shape.',
    effect: { kind: 'degrade', mult: 0.6 },
  },
  {
    lessonId: 'wire-cover-ejected', item: 'part:instruments', phase: 'cruise', anim: 'overheat',
    p: c => !c.design.instruments.includes('telescope') ? 0 : c.proc('faultSim') === 'fs_none' ? 0.25 : 0,
    text: 'The telescope cover popped off early. The coolant that kept the detector cold vented away and the craft spun.',
    effect: { kind: 'degrade', mult: 0.15 },
  },
  {
    lessonId: 'hitomi-attitude', item: 'part:attitude', phase: 'operations', anim: 'tumble',
    p: c => c.brief.kind !== 'telescope' ? 0 : c.proc('faultSim') === 'fs_full' ? 0.02 : 0.15,
    text: 'The craft thought it was spinning when it was not. Its thrusters fired the wrong way and it broke apart.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'maven-imu-2022', item: 'part:attitude', phase: 'operations', anim: 'wheel_fail',
    p: c => c.brief.target !== 'Mars' || c.brief.kind !== 'orbiter' ? 0 : 0.2,
    text: 'The motion sensor that tells the craft how it is turning started to fail.',
    effect: { kind: 'degrade', mult: 0.92 },
  },
  {
    lessonId: 'deep-impact-clock', item: 'process:faultSim', phase: 'end', anim: 'signal_lost',
    p: c => c.brief.missionDays < 3000 ? 0 : c.proc('faultSim') === 'fs_none' ? 0.4 : 0.05,
    text: 'Contact was lost. The likely cause: the onboard clock ran past the biggest number it could store and the computer kept rebooting.',
    effect: { kind: 'lost' },
  },
  {
    lessonId: 'near-burn-abort', item: 'process:faultSim', phase: 'arrival', anim: 'engine_cutoff',
    p: c => !isOrbiterLike(c) || !['biprop', 'mono_large'].includes(c.part('propulsion')) ? 0 : c.proc('faultSim') === 'fs_none' ? 0.25 : 0,
    text: 'The engine aborted the arrival burn seconds after starting. The craft flew past its target.',
    effect: { kind: 'degrade', mult: 0.8 },
  },
];

export function ruleFor(lessonId: string) {
  return RULES.find(r => r.lessonId === lessonId);
}

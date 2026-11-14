import type { Brief, Instrument, Part, ProcessOption } from './types';

// Part values are simplified teaching values, rounded so the trade offs are felt.
// They are not engineering specifications. Real spacecraft facts live in src/data/nssdca.json.

export const PARTS: Part[] = [
  // power (positive watts = generated at 1 AU for solar, fixed for RTG)
  { id: 'panel_small', slot: 'power', name: 'Small fixed solar panels', massKg: 25, powerW: 600, costM: 8, blurb: 'Cheap and simple. Enough near the Sun, weak far away.', look: 'panel_small' },
  { id: 'panel_large', slot: 'power', name: 'Large fixed solar panels', massKg: 70, powerW: 2400, costM: 20, blurb: 'Big panels bolted on. No moving parts to jam.', look: 'panel_large' },
  { id: 'panel_wings', slot: 'power', name: 'Deployable solar wings', massKg: 240, powerW: 14000, costM: 40, blurb: 'Huge wings that unfold in space. The only way to run on sunlight at Jupiter, but they must open.', look: 'panel_wings' },
  { id: 'rtg', slot: 'power', name: 'Nuclear power source (RTG)', massKg: 60, powerW: 250, costM: 110, blurb: 'Heat from decaying plutonium makes steady power anywhere. Expensive and scarce.', look: 'rtg' },

  // battery (powerW unused; capacity encoded in BATTERY_WH)
  { id: 'battery_s', slot: 'battery', name: 'Small battery', massKg: 10, powerW: 0, costM: 2, blurb: 'Light. Covers short shadows only.', look: 'battery_s' },
  { id: 'battery_m', slot: 'battery', name: 'Medium battery', massKg: 28, powerW: 0, costM: 5, blurb: 'A balanced choice for most orbits.', look: 'battery_m' },
  { id: 'battery_l', slot: 'battery', name: 'Large battery', massKg: 60, powerW: 0, costM: 10, blurb: 'Rides out long shadows and nights. Heavy.', look: 'battery_l' },

  // antenna (downlink encoded in DOWNLINK_MB)
  { id: 'lga', slot: 'antenna', name: 'Low gain antenna only', massKg: 4, powerW: -20, costM: 2, blurb: 'Always works, from any angle. Sends data at a trickle.', look: 'lga' },
  { id: 'hga_fixed', slot: 'antenna', name: 'Fixed dish antenna', massKg: 30, powerW: -45, costM: 15, blurb: 'A rigid dish. Fast data, nothing to unfold.', look: 'hga_fixed' },
  { id: 'hga_deployable', slot: 'antenna', name: 'Unfolding umbrella dish', massKg: 40, powerW: -70, costM: 30, blurb: 'A much bigger dish that opens like an umbrella after launch. The fastest data, if it opens.', look: 'hga_deployable' },

  // attitude
  { id: 'wheels_3', slot: 'attitude', name: 'Three reaction wheels', massKg: 30, powerW: -45, costM: 6, blurb: 'The minimum to point in any direction. Lose one and you are in trouble.', look: 'wheels_3' },
  { id: 'wheels_4', slot: 'attitude', name: 'Four reaction wheels', massKg: 40, powerW: -50, costM: 9, blurb: 'One spare wheel.', look: 'wheels_4' },
  { id: 'wheels_hybrid', slot: 'attitude', name: 'Four wheels plus thrusters', massKg: 55, powerW: -60, costM: 13, blurb: 'A spare wheel and thrusters that can take over pointing, using fuel.', look: 'wheels_hybrid' },

  // propulsion (delta v class encoded in PROP_CLASS)
  { id: 'mono_small', slot: 'propulsion', name: 'Small thruster tank', massKg: 60, powerW: -20, costM: 6, blurb: 'Enough to trim the path and point. Not enough to brake into orbit far away.', look: 'mono_small' },
  { id: 'mono_large', slot: 'propulsion', name: 'Large thruster tank', massKg: 150, powerW: -25, costM: 12, blurb: 'Enough to brake into orbit around Mars or the Moon.', look: 'mono_large' },
  { id: 'biprop', slot: 'propulsion', name: 'Main engine with pressurized tanks', massKg: 230, powerW: -40, costM: 28, blurb: 'A powerful engine for big braking burns. Depends on valves and pressure lines working on the day.', look: 'biprop' },
  { id: 'ion', slot: 'propulsion', name: 'Ion engine', massKg: 180, powerW: -2500, costM: 45, blurb: 'Gentle thrust for years. Huge total push, needs lots of power.', look: 'ion' },

  // computer
  { id: 'cpu_single', slot: 'computer', name: 'Single flight computer', massKg: 10, powerW: -30, costM: 4, blurb: 'One brain. If it resets, the craft waits for help.', look: 'cpu_single' },
  { id: 'cpu_dual', slot: 'computer', name: 'Two flight computers', massKg: 18, powerW: -40, costM: 9, blurb: 'A backup brain that can take over.', look: 'cpu_dual' },

  // thermal
  { id: 'thermal_basic', slot: 'thermal', name: 'Basic insulation and heaters', massKg: 15, powerW: -40, costM: 2, blurb: 'Fine near Earth.', look: 'thermal_basic' },
  { id: 'thermal_full', slot: 'thermal', name: 'Full thermal control', massKg: 40, powerW: -40, costM: 8, blurb: 'Sunshades, louvers and heaters for very hot or very cold places.', look: 'thermal_full' },
];

export const BATTERY_WH: Record<string, number> = { battery_s: 600, battery_m: 1800, battery_l: 4500 };
/** Data the antenna can send home per day near Earth, megabits. Multiplied by the brief linkFactor. */
export const DOWNLINK_MB: Record<string, number> = { lga: 300, hga_fixed: 40000, hga_deployable: 160000 };
export const PROP_CLASS: Record<string, number> = { mono_small: 1, mono_large: 2, biprop: 3, ion: 3 };
export const NEED_CLASS = { low: 1, medium: 2, high: 3 } as const;

export const INSTRUMENTS: Instrument[] = [
  { id: 'camera', name: 'Camera', massKg: 20, powerW: 30, costM: 25, dataMbDay: 6000, science: 30, blurb: 'Pictures of the surface or clouds.', look: 'camera' },
  { id: 'spectrometer', name: 'Spectrometer', massKg: 25, powerW: 25, costM: 30, dataMbDay: 2500, science: 30, blurb: 'Splits light to tell what things are made of.', look: 'spectrometer' },
  { id: 'magnetometer', name: 'Magnetometer', massKg: 5, powerW: 5, costM: 8, dataMbDay: 40, science: 15, blurb: 'Measures magnetic fields. Light and cheap.', look: 'magnetometer' },
  { id: 'radar', name: 'Radar', massKg: 60, powerW: 150, costM: 45, dataMbDay: 9000, science: 35, blurb: 'Sees through clouds and under the surface. Power hungry.', look: 'radar' },
  { id: 'particle', name: 'Particle detector', massKg: 10, powerW: 10, costM: 12, dataMbDay: 120, science: 15, blurb: 'Counts charged particles around the target.', look: 'particle' },
  { id: 'telescope', name: 'Space telescope', massKg: 300, powerW: 60, costM: 130, dataMbDay: 3000, science: 70, blurb: 'A big mirror and detector for faint, distant light.', look: 'telescope' },
  { id: 'seismometer', name: 'Seismometer', massKg: 30, powerW: 15, costM: 35, dataMbDay: 300, science: 35, blurb: 'Feels quakes to see inside a planet. Landers only.', look: 'particle' },
];

export const PROCESS_OPTIONS: ProcessOption[] = [
  { id: 'ic_none', process: 'interfaceCheck', label: 'No cross team check', costM: 0, scheduleDays: 0, blurb: 'Each team trusts the others files and units.' },
  { id: 'ic_spot', process: 'interfaceCheck', label: 'Spot check key files', costM: 4, scheduleDays: 20, blurb: 'Check the most important data passed between teams.' },
  { id: 'ic_full', process: 'interfaceCheck', label: 'End to end interface test', costM: 12, scheduleDays: 55, blurb: 'Run real data through every team, unit and wire, start to finish.' },
  { id: 'dt_none', process: 'deployTest', label: 'No deployment test', costM: 0, scheduleDays: 0, blurb: 'Trust the design. Things unfold for the first time in space.' },
  { id: 'dt_part', process: 'deployTest', label: 'Test each part alone', costM: 5, scheduleDays: 20, blurb: 'Unfold each part on the bench before it is attached.' },
  { id: 'dt_full', process: 'deployTest', label: 'Test after full assembly', costM: 15, scheduleDays: 45, blurb: 'Unfold everything on the finished craft, after shaking and shipping it like the real trip.' },
  { id: 'fs_none', process: 'faultSim', label: 'No fault simulation', costM: 0, scheduleDays: 0, blurb: 'Test that things work. Not what happens when they do not.' },
  { id: 'fs_basic', process: 'faultSim', label: 'Basic fault tests', costM: 5, scheduleDays: 20, blurb: 'Test the obvious failures on the software.' },
  { id: 'fs_full', process: 'faultSim', label: 'Stress test edge cases', costM: 15, scheduleDays: 50, blurb: 'Hammer the software with odd timings, sensor glitches and overloads.' },
  { id: 'fm_0', process: 'fuelMargin', label: 'No spare fuel', costM: 0, scheduleDays: 0, blurb: 'Exactly the fuel the plan needs.' },
  { id: 'fm_10', process: 'fuelMargin', label: '10 percent spare fuel', costM: 3, scheduleDays: 0, blurb: 'A little room for surprises.' },
  { id: 'fm_25', process: 'fuelMargin', label: '25 percent spare fuel', costM: 6, scheduleDays: 0, blurb: 'Room to extend the mission. Heavier.' },
];

export const FUEL_MASS_FACTOR: Record<string, number> = { fm_0: 0, fm_10: 0.1, fm_25: 0.25 };

// Budgets are approximate real total mission costs (development plus launch, rounded),
// shown as "about". They were not competed caps unless the note says so.
export const BRIEFS: Brief[] = [
  {
    id: 'jupiter', title: 'Orbit Jupiter', target: 'Jupiter', kind: 'orbiter',
    goal: 'Map Jupiter’s gravity and magnetic field from a close polar orbit to learn what is inside the planet.',
    story: 'Five years of travel for one chance to brake into orbit.',
    budgetM: 1100, budgetNote: 'About the real cost of Juno, not a cap', launchMassLimitKg: 1700,
    sunFactor: 0.037, eclipseFraction: 0, missionDays: 2000, arrivalDay: 1795, deltaVNeed: 'high',
    realCraft: 'juno', maxInstruments: 4, linkFactor: 0.12, scheduleSlackDays: 125,
  },
  {
    id: 'mars-orbit', title: 'Map Mars from orbit', target: 'Mars', kind: 'orbiter',
    goal: 'Photograph Mars in fine detail and send home more data than any mission before.',
    story: 'The orbit circles Mars every two hours, and part of every lap is in shadow.',
    budgetM: 720, budgetNote: 'About the real cost of Mars Reconnaissance Orbiter, not a cap', launchMassLimitKg: 1100,
    sunFactor: 0.43, eclipseFraction: 0.35, missionDays: 1500, arrivalDay: 210, deltaVNeed: 'medium',
    realCraft: 'mro', maxInstruments: 4, linkFactor: 0.25, scheduleSlackDays: 125,
  },
  {
    id: 'planets', title: 'Hunt for planets around other stars', target: 'One patch of sky', kind: 'telescope',
    goal: 'Stare at one field of stars for years and catch the tiny dips when planets pass in front.',
    story: 'Years of holding perfectly still. Any wobble ruins the data.',
    budgetM: 600, budgetNote: 'About the real cost of Kepler, not a cap', launchMassLimitKg: 1100,
    sunFactor: 1, eclipseFraction: 0, missionDays: 1500, arrivalDay: 30, deltaVNeed: 'low',
    realCraft: 'kepler', maxInstruments: 2, linkFactor: 0.4, scheduleSlackDays: 115,
  },
  {
    id: 'pluto', title: 'Fly past Pluto', target: 'Pluto', kind: 'flyby',
    goal: 'Race across the solar system and photograph Pluto in one fast pass.',
    story: 'Nine and a half years of travel for one day of science.',
    budgetM: 700, budgetNote: 'About the real cost of New Horizons, not a cap', launchMassLimitKg: 480,
    sunFactor: 0.0006, eclipseFraction: 0, missionDays: 3470, arrivalDay: 3463, deltaVNeed: 'low',
    realCraft: 'new-horizons', maxInstruments: 4, linkFactor: 0.02, scheduleSlackDays: 115,
  },
  {
    id: 'mercury', title: 'Orbit Mercury', target: 'Mercury', kind: 'orbiter',
    goal: 'Map the planet closest to the Sun, where sunlight is up to ten times stronger than at Earth.',
    story: 'Years of looping flybys to slow down, then life in an oven.',
    budgetM: 450, budgetNote: 'About the real cost of MESSENGER, a Discovery class mission', launchMassLimitKg: 700,
    sunFactor: 6, eclipseFraction: 0.12, missionDays: 3900, arrivalDay: 2420, deltaVNeed: 'high',
    realCraft: 'messenger', maxInstruments: 4, linkFactor: 0.4, scheduleSlackDays: 125,
  },
  {
    id: 'mars-land', title: 'Land on Mars', target: 'Mars surface', kind: 'lander',
    goal: 'Land safely and listen for marsquakes to see inside the planet.',
    story: 'Seven minutes from the top of the atmosphere to the ground, all on autopilot.',
    budgetM: 830, budgetNote: 'About the real cost of InSight, not a cap', launchMassLimitKg: 620,
    sunFactor: 0.43, eclipseFraction: 0.5, missionDays: 1440, arrivalDay: 205, deltaVNeed: 'medium',
    realCraft: 'insight', maxInstruments: 3, linkFactor: 0.15, scheduleSlackDays: 125,
  },
];

/** Fixed share of each budget that goes to the bus, launch, operations and the team. */
export const FIXED_COST_SHARE = 0.62;
/** Structure, wiring and cabling as a share of the parts mass. */
export const STRUCTURE_SHARE = 0.3;

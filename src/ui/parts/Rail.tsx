import type { BudgetReport } from '../eng';
import { kg, usd, watts, hours, mb, days, n0 } from '../format';

interface G {
  key: string;
  label: string;
  /** One short line: value against its limit. */
  line: string;
  /** The full wording, for the tooltip and screen readers. */
  full: string;
  ratio: number; // value / limit, 1 = at limit
  bad: boolean;
}

function gauges(r: BudgetReport, science?: number): G[] {
  const sci: G[] = science === undefined ? [] : [{ key: 'science', label: 'Science', line: `${n0(science)}% if all goes well`, full: `${science}% of full marks if nothing breaks: instruments, antenna, battery and orbit together`, ratio: science / 125, bad: science < 60 }];
  return [...sci,
    { key: 'mass', label: 'Mass', line: `${n0(r.massKg)} / ${kg(r.massLimitKg)}`, full: `${kg(r.massKg)}, dry limit ${kg(r.massLimitKg)}`, ratio: r.massKg / Math.max(1, r.massLimitKg), bad: r.massKg > r.massLimitKg },
    { key: 'cost', label: 'Cost', line: `${usd(r.costM)} / ${usd(r.budgetM)}`, full: `${usd(r.costM)}, budget ${usd(r.budgetM)}`, ratio: r.costM / Math.max(1, r.budgetM), bad: r.costM > r.budgetM },
    { key: 'power', label: 'Power', line: `${n0(r.powerUseW)} / ${watts(r.powerGenW)}`, full: `${watts(r.powerUseW)} used, ${watts(r.powerGenW)} made`, ratio: r.powerUseW / Math.max(1, r.powerGenW), bad: r.powerUseW > r.powerGenW },
    r.eclipseHours > 0
      ? { key: 'battery', label: 'Battery', line: `${hours(r.batteryHours)} / ${hours(r.eclipseHours)} dark`, full: `${hours(r.batteryHours)} stored, ${hours(r.eclipseHours)} of shadow`, ratio: r.eclipseHours / Math.max(0.01, r.batteryHours), bad: r.batteryHours < r.eclipseHours }
      : { key: 'battery', label: 'Battery', line: `${hours(r.batteryHours)}, no shadow`, full: `${hours(r.batteryHours)} stored, no shadow`, ratio: 0, bad: false },
    { key: 'data', label: 'Data', line: `${mb(r.dataMbDay)} / ${mb(r.downlinkMbDay)}`, full: `${mb(r.dataMbDay)} a day made, ${mb(r.downlinkMbDay)} a day sent`, ratio: r.dataMbDay / Math.max(1, r.downlinkMbDay), bad: r.dataMbDay > r.downlinkMbDay },
    { key: 'schedule', label: 'Tests', line: days(r.scheduleDays), full: `${days(r.scheduleDays)} of added work`, ratio: 0, bad: false },
  ];
}

/** One line meters: label, bar against the limit, value over limit. */
export function Rail({ report, compact, science }: { report: BudgetReport; compact?: boolean; science?: number }) {
  return (
    <div className={'rail' + (compact ? ' rail-compact' : '')} role="list" aria-label="Resources">
      {gauges(report, science).map((g) => (
        <div key={g.key} role="listitem" className={'gauge' + (g.bad ? ' bad' : '')} title={g.full} aria-label={`${g.label}: ${g.full}`}>
          <span className="gauge-label">{g.label}</span>
          <span className="gauge-track" aria-hidden="true">
            <span className="gauge-fill" style={{ width: `${Math.min(100, g.ratio * 80)}%` }} />
            {g.ratio > 0 && <span className="gauge-limit" style={{ left: '80%' }} />}
          </span>
          <span className="gauge-val">{g.line}</span>
        </div>
      ))}
    </div>
  );
}

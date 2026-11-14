import type { BudgetReport } from '../eng';
import { kg, usd, watts, hours, mb, days } from '../format';

interface G {
  key: string;
  label: string;
  value: string;
  limit: string;
  ratio: number; // value / limit, 1 = at limit
  bad: boolean;
  note?: string;
}

function gauges(r: BudgetReport): G[] {
  const out: G[] = [
    { key: 'mass', label: 'Mass', value: kg(r.massKg), limit: `limit ${kg(r.massLimitKg)}`, ratio: r.massKg / Math.max(1, r.massLimitKg), bad: r.massKg > r.massLimitKg },
    { key: 'cost', label: 'Cost', value: usd(r.costM), limit: `budget ${usd(r.budgetM)}`, ratio: r.costM / Math.max(1, r.budgetM), bad: r.costM > r.budgetM },
    { key: 'power', label: 'Power', value: `${watts(r.powerUseW)} used`, limit: `${watts(r.powerGenW)} made`, ratio: r.powerUseW / Math.max(1, r.powerGenW), bad: r.powerUseW > r.powerGenW },
    r.eclipseHours > 0
      ? { key: 'battery', label: 'Battery', value: `${hours(r.batteryHours)} stored`, limit: `${hours(r.eclipseHours)} shadow`, ratio: r.eclipseHours / Math.max(0.01, r.batteryHours), bad: r.batteryHours < r.eclipseHours }
      : { key: 'battery', label: 'Battery', value: `${hours(r.batteryHours)} stored`, limit: 'no shadow', ratio: 0, bad: false },
    { key: 'data', label: 'Data', value: `${mb(r.dataMbDay)} a day`, limit: `${mb(r.downlinkMbDay)} sent`, ratio: r.dataMbDay / Math.max(1, r.downlinkMbDay), bad: r.dataMbDay > r.downlinkMbDay },
    { key: 'schedule', label: 'Schedule', value: days(r.scheduleDays), limit: 'added work', ratio: 0, bad: false },
  ];
  return out;
}

export function Rail({ report, compact }: { report: BudgetReport; compact?: boolean }) {
  return (
    <div className={'rail' + (compact ? ' rail-compact' : '')} role="list" aria-label="Resources">
      {gauges(report).map((g) => (
        <div key={g.key} role="listitem" className={'gauge' + (g.bad ? ' bad' : '')}>
          <div className="gauge-top">
            <span className="gauge-label">{g.label}</span>
            <span className="gauge-val">{g.value}</span>
          </div>
          <div className="gauge-track" aria-hidden="true">
            <span className="gauge-fill" style={{ width: `${Math.min(100, g.ratio * 80)}%` }} />
            {g.ratio > 0 && <span className="gauge-limit" style={{ left: '80%' }} />}
            {g.ratio > 1.25 && <span className="gauge-over" />}
          </div>
          <div className="gauge-sub">{g.limit}</div>
        </div>
      ))}
    </div>
  );
}

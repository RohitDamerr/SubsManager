// DateRange — preset chips plus custom from/to dates.  Value: { from, to } as yyyy-mm-dd ('' = open).
import { dateInput } from '../lib/format.js';

function preset(kind) {
  const now = new Date();
  const today = dateInput(now);
  switch (kind) {
    case 'month': return { from: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'lastMonth': return {
      from: dateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: dateInput(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
    case 'quarter': return { from: dateInput(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: today };
    case 'year': return { from: dateInput(new Date(now.getFullYear(), 0, 1)), to: today };
    case '12m': return { from: dateInput(new Date(now.getFullYear(), now.getMonth() - 11, 1)), to: today };
    default: return { from: '', to: '' };
  }
}

const PRESETS = [['all', 'All time'], ['month', 'This month'], ['lastMonth', 'Last month'], ['quarter', 'This quarter'], ['year', 'This year']];

export function DateRange({ value, onChange, presets = PRESETS }) {
  const active = presets.find(([k]) => {
    const p = preset(k);
    return p.from === value.from && p.to === value.to;
  })?.[0];

  return (
    <div className="filters">
      <div className="tabs">
        {presets.map(([k, l]) => (
          <button key={k} type="button" className={`tab ${active === k ? 'active' : ''}`} onClick={() => onChange(preset(k))}>{l}</button>
        ))}
      </div>
      <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} style={{ width: 150 }} aria-label="From" />
      <span className="muted">–</span>
      <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} style={{ width: 150 }} aria-label="To" />
    </div>
  );
}

export { preset as dateRangePreset };

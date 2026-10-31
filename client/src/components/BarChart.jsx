// BarChart — dependency-free SVG bars for a revenue series [{ period, total }].
import { formatMoney } from '../lib/format.js';

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

function niceMax(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

export function BarChart({ series }) {
  const max = niceMax(Math.max(...series.map((s) => s.total), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(series.length, 1);
  const barW = Math.min(36, slot * 0.6);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const short = (paise) => {
    const r = paise / 100;
    return r >= 100000 ? `₹${(r / 100000).toFixed(1)}L` : r >= 1000 ? `₹${(r / 1000).toFixed(1)}k` : `₹${r.toFixed(0)}`;
  };

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Revenue by month">
      {ticks.map((t) => {
        const y = PAD.top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
            <text className="axis" x={PAD.left - 8} y={y + 4} textAnchor="end">{short(t)}</text>
          </g>
        );
      })}
      {series.map((s, i) => {
        const h = (s.total / max) * innerH;
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={s.period}>
            <rect className="bar" x={x} y={PAD.top + innerH - h} width={barW} height={Math.max(h, s.total ? 2 : 0)} rx="3">
              <title>{`${s.label}: ${formatMoney(s.total)}`}</title>
            </rect>
            <text className="axis" x={x + barW / 2} y={H - 8} textAnchor="middle">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

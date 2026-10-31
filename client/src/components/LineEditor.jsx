// LineEditor — pick product + variant + quantity lines (templates and subscriptions).
// Value: [{ productId, variantId?, quantity }].  Price shown is a preview; the server computes it.
import { useState } from 'react';
import { formatMoney } from '../lib/format.js';

export function LineEditor({ products, value, onChange }) {
  const [draft, setDraft] = useState({ productId: '', variantId: '', quantity: 1 });
  const byId = new Map(products.map((p) => [p._id, p]));
  const selected = byId.get(draft.productId);

  const unitPrice = (line) => {
    const p = byId.get(line.productId);
    if (!p) return 0;
    const v = p.variants?.find((x) => x._id === line.variantId);
    return p.salesPrice + (v?.extraPrice || 0);
  };
  const label = (line) => {
    const p = byId.get(line.productId);
    const v = p?.variants?.find((x) => x._id === line.variantId);
    return `${p?.name || 'Unknown product'}${v ? ` (${v.attribute}: ${v.value})` : ''}`;
  };

  const add = () => {
    if (!draft.productId || draft.quantity < 1) return;
    const line = { productId: draft.productId, quantity: Number(draft.quantity) };
    if (draft.variantId) line.variantId = draft.variantId;
    onChange([...value, line]);
    setDraft({ productId: '', variantId: '', quantity: 1 });
  };

  return (
    <div className="line-editor">
      {value.length > 0 && (
        <table>
          <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>
            {value.map((l, i) => (
              <tr key={i}>
                <td>{label(l)}</td>
                <td className="num">{l.quantity}</td>
                <td className="num">{formatMoney(unitPrice(l))}</td>
                <td className="num">{formatMoney(unitPrice(l) * l.quantity)}</td>
                <td className="num"><button type="button" className="ghost sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="line-add">
        <div>
          <label>Product</label>
          <select value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value, variantId: '' })}>
            <option value="">Select product…</option>
            {products.filter((p) => p.isActive !== false).map((p) => (
              <option key={p._id} value={p._id}>{p.name} — {formatMoney(p.salesPrice)}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Variant</label>
          <select value={draft.variantId} onChange={(e) => setDraft({ ...draft, variantId: e.target.value })} disabled={!selected?.variants?.length}>
            <option value="">{selected?.variants?.length ? 'Base product' : 'No variants'}</option>
            {(selected?.variants || []).map((v) => (
              <option key={v._id} value={v._id}>{v.attribute}: {v.value} (+{formatMoney(v.extraPrice)})</option>
            ))}
          </select>
        </div>
        <div>
          <label>Qty</label>
          <input type="number" min="1" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
        </div>
        <button type="button" className="secondary" onClick={add} disabled={!draft.productId}>Add</button>
      </div>
    </div>
  );
}

// Discounts — Admin create/edit, Staff read-only.  Rules are applied automatically by
// the billing run (best product discount per line, then best subscription discount).
import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discounts, products } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { addDays, dateInput, formatDate, fromPaise, toPaise } from '../../lib/format.js';

function liveState(d) {
  const now = new Date();
  if (!d.isActive) return ['gray', 'Inactive'];
  if (new Date(d.startDate) > now) return ['blue', 'Scheduled'];
  if (new Date(d.endDate) < now) return ['gray', 'Expired'];
  if (d.usageLimit != null && d.usedCount >= d.usageLimit) return ['amber', 'Used up'];
  return ['green', 'Live'];
}

export default function Discounts() {
  const { user } = useAuth();
  const writable = can(user, 'discount:write');
  const [editing, setEditing] = useState(null);
  const [f, setF] = useUrlFilters({ q: '' });
  const list = useQuery({ queryKey: ['discounts', f.q], queryFn: () => discounts.list({ limit: 100, ...compact(f) }), placeholderData: keepPreviousData });
  const productsQ = useQuery({ queryKey: ['products', 'all'], queryFn: () => products.list({ limit: 100 }) });
  const productById = new Map((productsQ.data?.data || []).map((p) => [p._id, p]));
  const rows = list.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Discounts"
        subtitle="Applied automatically on the next invoice when the conditions match."
        actions={writable && <button onClick={() => setEditing('new')}>+ New discount</button>}
      />
      <Card bodyless>
        <div className="toolbar"><SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder="Search discounts" /></div>
        <QueryState query={list} isEmpty={!rows.length} empty={<Empty title={f.q ? `Nothing matches "${f.q}"` : 'No discounts yet'} />}>
          <DataTable
            data={rows}
            onRowClick={writable ? (d) => setEditing(d) : undefined}
            columns={[
              { key: 'name', label: 'Name', render: (d) => <span className="strong">{d.name}</span> },
              { key: 'value', label: 'Value', render: (d) => (d.type === 'PERCENT' ? `${d.value}%` : <MoneyText amount={d.value} />) },
              { key: 'scope', label: 'Applies to', render: (d) => (d.scope === 'SUBSCRIPTION' ? 'Whole invoice' : (d.productIds || []).map((id) => <span key={id} className="chip">{productById.get(id)?.name || 'Product'}</span>)) },
              { key: 'conditions', label: 'Conditions', render: (d) => [d.minPurchase ? `Min ₹${fromPaise(d.minPurchase)}` : null, d.minQuantity ? `Min qty ${d.minQuantity}` : null].filter(Boolean).join(' · ') || <span className="muted">—</span> },
              { key: 'dates', label: 'Valid', render: (d) => `${formatDate(d.startDate)} – ${formatDate(d.endDate)}` },
              { key: 'usage', label: 'Used', align: 'right', render: (d) => `${d.usedCount || 0}${d.usageLimit != null ? ` / ${d.usageLimit}` : ''}` },
              { key: 'state', label: 'Status', render: (d) => { const [tone, l] = liveState(d); return <span className={`badge badge-${tone}`}>{l}</span>; } },
            ]}
          />
        </QueryState>
      </Card>
      {editing && <DiscountForm discount={editing === 'new' ? null : editing} productList={productsQ.data?.data || []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DiscountForm({ discount: d, productList, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: d?.name || '',
    type: d?.type || 'PERCENT',
    value: d ? (d.type === 'PERCENT' ? String(d.value) : fromPaise(d.value)) : '10',
    scope: d?.scope || 'SUBSCRIPTION',
    productIds: d?.productIds || [],
    minPurchase: d?.minPurchase ? fromPaise(d.minPurchase) : '',
    minQuantity: d?.minQuantity ?? '',
    startDate: dateInput(d?.startDate || new Date()),
    endDate: dateInput(d?.endDate || addDays(new Date(), 90)),
    usageLimit: d?.usageLimit ?? '',
    isActive: d?.isActive ?? true,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: (b) => (d ? discounts.update(d._id, b) : discounts.create(b)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['discounts'] }); toast(d ? 'Discount updated' : 'Discount created'); onClose(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const b = {
      name: form.name,
      type: form.type,
      value: form.type === 'PERCENT' ? Math.round(Number(form.value)) : toPaise(form.value),
      scope: form.scope,
      productIds: form.scope === 'PRODUCT' ? form.productIds : [],
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(`${form.endDate}T23:59:59`).toISOString(),
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      isActive: form.isActive,
    };
    if (form.minPurchase !== '') b.minPurchase = toPaise(form.minPurchase);
    if (form.minQuantity !== '') b.minQuantity = Number(form.minQuantity);
    save.mutate(b);
  };

  const toggleProduct = (id) => setForm({ ...form, productIds: form.productIds.includes(id) ? form.productIds.filter((p) => p !== id) : [...form.productIds, id] });

  return (
    <Modal title={d ? `Edit ${d.name}` : 'New discount'} onClose={onClose} wide>
      <ErrorAlert error={save.error} />
      <form onSubmit={handleSubmit}>
        <Field label="Name"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <div className="form-grid">
          <Field label="Type">
            <select value={form.type} onChange={set('type')}><option value="PERCENT">Percent off</option><option value="FIXED">Fixed amount off</option></select>
          </Field>
          <Field label={form.type === 'PERCENT' ? 'Percent (1–100)' : 'Amount (₹)'}>
            <input type="number" step={form.type === 'PERCENT' ? '1' : '0.01'} min="1" max={form.type === 'PERCENT' ? 100 : undefined} value={form.value} onChange={set('value')} required />
          </Field>
          <Field label="Applies to">
            <select value={form.scope} onChange={set('scope')}><option value="SUBSCRIPTION">Whole invoice</option><option value="PRODUCT">Specific products</option></select>
          </Field>
        </div>
        {form.scope === 'PRODUCT' && (
          <Field label="Products">
            {productList.map((p) => (
              <label key={p._id} className="check"><input type="checkbox" checked={form.productIds.includes(p._id)} onChange={() => toggleProduct(p._id)} />{p.name}</label>
            ))}
          </Field>
        )}
        <div className="form-grid">
          <Field label="Starts"><input type="date" value={form.startDate} onChange={set('startDate')} required /></Field>
          <Field label="Ends"><input type="date" value={form.endDate} onChange={set('endDate')} required /></Field>
          <Field label="Usage limit" hint="Blank = unlimited"><input type="number" min="1" value={form.usageLimit} onChange={set('usageLimit')} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Minimum purchase (₹)" hint={form.scope === 'PRODUCT' ? 'Checked per line' : 'Checked on the invoice subtotal'}><input type="number" step="0.01" min="0" value={form.minPurchase} onChange={set('minPurchase')} /></Field>
          <Field label="Minimum quantity"><input type="number" min="0" value={form.minQuantity} onChange={set('minQuantity')} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={save.isPending || (form.scope === 'PRODUCT' && !form.productIds.length)}>{save.isPending ? 'Saving…' : 'Save discount'}</button>
        </div>
      </form>
    </Modal>
  );
}

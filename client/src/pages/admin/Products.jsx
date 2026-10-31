// Products with embedded variants.  Admin: create/edit/add variants and sees cost & margin.
// Staff: read-only (the API also strips cost price for them).
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { products, taxes } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { fromPaise, toPaise } from '../../lib/format.js';

export default function Products() {
  const { user } = useAuth();
  const writable = can(user, 'catalog:write');
  const showCost = can(user, 'catalog:viewCost');
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [variantFor, setVariantFor] = useState(null);

  const list = useQuery({ queryKey: ['products', 'all'], queryFn: () => products.list({ limit: 100 }) });
  const taxesQ = useQuery({ queryKey: ['taxes'], queryFn: () => taxes.list() });
  const taxById = new Map((taxesQ.data?.data || []).map((t) => [t._id, t]));
  const rows = list.data?.data || [];

  const columns = [
    { key: 'name', label: 'Product', render: (p) => <><span className="strong">{p.name}</span><div className="subtle">{p.type === 'GOOD' ? 'Good' : 'Service'}</div></> },
    { key: 'variants', label: 'Variants', render: (p) => (p.variants?.length ? p.variants.map((v) => <span key={v._id} className="chip">{v.attribute}: {v.value}{v.extraPrice ? ` +₹${fromPaise(v.extraPrice)}` : ''}</span>) : <span className="muted">—</span>) },
    { key: 'taxes', label: 'Tax', render: (p) => (p.taxIds || []).map((id) => taxById.get(id)?.name).filter(Boolean).join(', ') || <span className="muted">—</span> },
    { key: 'salesPrice', label: 'Price', align: 'right', render: (p) => <MoneyText amount={p.salesPrice} /> },
  ];
  if (showCost) {
    columns.push(
      { key: 'costPrice', label: 'Cost', align: 'right', render: (p) => <MoneyText amount={p.costPrice || 0} /> },
      { key: 'margin', label: 'Margin', align: 'right', render: (p) => (p.salesPrice ? `${Math.round(((p.salesPrice - (p.costPrice || 0)) / p.salesPrice) * 100)}%` : '—') },
    );
  }
  columns.push({ key: 'isActive', label: 'Status', render: (p) => <span className={`badge badge-${p.isActive ? 'green' : 'gray'}`}>{p.isActive ? 'Active' : 'Archived'}</span> });
  if (writable) {
    columns.push({
      key: 'actions', label: '', align: 'right', render: (p) => (
        <span onClick={(e) => e.stopPropagation()}>
          <button className="secondary sm" onClick={() => setVariantFor(p)}>+ Variant</button>{' '}
          <button className="secondary sm" onClick={() => setEditing(p)}>Edit</button>
        </span>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={writable ? 'Prices are per unit, per billing period.' : 'Read-only — ask an admin to change the catalog.'}
        actions={writable && <button onClick={() => setEditing('new')}>+ New product</button>}
      />
      <Card bodyless>
        <QueryState query={list} isEmpty={!rows.length} empty={<Empty title="No products yet" />}>
          <DataTable data={rows} columns={columns} />
        </QueryState>
      </Card>
      {editing && <ProductForm product={editing === 'new' ? null : editing} taxList={taxesQ.data?.data || []} onClose={() => setEditing(null)} />}
      {variantFor && <VariantForm product={variantFor} onClose={() => setVariantFor(null)} />}
    </div>
  );
}

function ProductForm({ product, taxList, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: product?.name || '',
    type: product?.type || 'SERVICE',
    salesPrice: fromPaise(product?.salesPrice ?? 0),
    costPrice: fromPaise(product?.costPrice ?? 0),
    taxIds: product?.taxIds || [],
    isActive: product?.isActive ?? true,
    notes: product?.notes || '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: (b) => (product ? products.update(product._id, b) : products.create(b)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast(product ? 'Product updated' : 'Product created');
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const b = { ...form, salesPrice: toPaise(form.salesPrice) ?? 0, costPrice: toPaise(form.costPrice) ?? 0 };
    if (!b.notes) delete b.notes;
    save.mutate(b);
  };

  const toggleTax = (id) => setForm({ ...form, taxIds: form.taxIds.includes(id) ? form.taxIds.filter((t) => t !== id) : [...form.taxIds, id] });

  return (
    <Modal title={product ? `Edit ${product.name}` : 'New product'} onClose={onClose}>
      <ErrorAlert error={save.error} />
      <form onSubmit={handleSubmit}>
        <Field label="Name"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <div className="form-grid">
          <Field label="Type">
            <select value={form.type} onChange={set('type')}><option value="SERVICE">Service</option><option value="GOOD">Good</option></select>
          </Field>
          <Field label="Sales price (₹)"><input type="number" step="0.01" min="0" value={form.salesPrice} onChange={set('salesPrice')} required /></Field>
          <Field label="Cost price (₹)" hint="Admin only — used for margin"><input type="number" step="0.01" min="0" value={form.costPrice} onChange={set('costPrice')} /></Field>
        </div>
        <Field label="Taxes">
          {taxList.length ? taxList.map((t) => (
            <label key={t._id} className="check"><input type="checkbox" checked={form.taxIds.includes(t._id)} onChange={() => toggleTax(t._id)} />{t.name}</label>
          )) : <span className="muted">No taxes defined yet.</span>}
        </Field>
        <Field label="Notes"><textarea rows="2" value={form.notes} onChange={set('notes')} /></Field>
        <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active (available for new subscriptions)</label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save product'}</button>
        </div>
      </form>
    </Modal>
  );
}

function VariantForm({ product, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ attribute: '', value: '', extraPrice: '0' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const add = useMutation({
    mutationFn: (b) => products.addVariant(product._id, b),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['products'] }); toast('Variant added'); onClose(); },
  });

  return (
    <Modal title={`Add variant — ${product.name}`} onClose={onClose}>
      <ErrorAlert error={add.error} />
      <form onSubmit={(e) => { e.preventDefault(); add.mutate({ ...form, extraPrice: toPaise(form.extraPrice) ?? 0 }); }}>
        <div className="form-grid">
          <Field label="Attribute" hint="e.g. brand"><input value={form.attribute} onChange={set('attribute')} required autoFocus /></Field>
          <Field label="Value" hint="e.g. Odoo"><input value={form.value} onChange={set('value')} required /></Field>
          <Field label="Extra price (₹)"><input type="number" step="0.01" value={form.extraPrice} onChange={set('extraPrice')} /></Field>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={add.isPending}>Add variant</button>
        </div>
      </form>
    </Modal>
  );
}

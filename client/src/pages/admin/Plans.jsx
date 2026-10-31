// Plans — Admin create/edit, Staff read-only.  Plan flags drive which subscription actions are allowed.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plans } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { fromPaise, PERIOD_LABEL, toPaise } from '../../lib/format.js';

const FLAGS = [
  ['allowPause', 'Customers can pause'],
  ['allowEarlyClose', 'Can close before expiry'],
  ['allowRenew', 'Can renew'],
  ['autoClose', 'Auto-close at expiry'],
];

export default function Plans() {
  const { user } = useAuth();
  const writable = can(user, 'catalog:write');
  const [editing, setEditing] = useState(null);
  const list = useQuery({ queryKey: ['plans'], queryFn: () => plans.list({ limit: 100 }) });
  const rows = list.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Plans"
        subtitle={writable ? 'Billing period and rules for subscriptions.' : 'Read-only — ask an admin to change plans.'}
        actions={writable && <button onClick={() => setEditing('new')}>+ New plan</button>}
      />
      <Card bodyless>
        <QueryState query={list} isEmpty={!rows.length} empty={<Empty title="No plans yet" />}>
          <DataTable
            data={rows}
            onRowClick={writable ? (p) => setEditing(p) : undefined}
            columns={[
              { key: 'name', label: 'Plan', render: (p) => <span className="strong">{p.name}</span> },
              { key: 'period', label: 'Billing', render: (p) => PERIOD_LABEL[p.billingPeriod] },
              { key: 'minQuantity', label: 'Min qty', align: 'right', render: (p) => p.minQuantity || 0 },
              { key: 'flags', label: 'Rules', render: (p) => FLAGS.filter(([k]) => p[k]).map(([k, l]) => <span key={k} className="chip">{l}</span>) },
              { key: 'price', label: 'Price', align: 'right', render: (p) => <MoneyText amount={p.price} /> },
            ]}
          />
        </QueryState>
      </Card>
      {editing && <PlanForm plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanForm({ plan, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: plan?.name || '',
    price: fromPaise(plan?.price ?? 0),
    billingPeriod: plan?.billingPeriod || 'MONTHLY',
    minQuantity: plan?.minQuantity ?? 1,
    allowPause: plan?.allowPause ?? true,
    allowEarlyClose: plan?.allowEarlyClose ?? true,
    allowRenew: plan?.allowRenew ?? true,
    autoClose: plan?.autoClose ?? false,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: (b) => (plan ? plans.update(plan._id, b) : plans.create(b)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); toast(plan ? 'Plan updated' : 'Plan created'); onClose(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    save.mutate({ ...form, price: toPaise(form.price) ?? 0, minQuantity: Number(form.minQuantity) || 0 });
  };

  return (
    <Modal title={plan ? `Edit ${plan.name}` : 'New plan'} onClose={onClose}>
      <ErrorAlert error={save.error} />
      <form onSubmit={handleSubmit}>
        <Field label="Name"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <div className="form-grid">
          <Field label="Billing period">
            <select value={form.billingPeriod} onChange={set('billingPeriod')}>
              {Object.entries(PERIOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Price (₹)"><input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} required /></Field>
          <Field label="Minimum quantity"><input type="number" min="0" value={form.minQuantity} onChange={set('minQuantity')} /></Field>
        </div>
        <Field label="Rules">
          {FLAGS.map(([k, l]) => (
            <label key={k} className="check"><input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />{l}</label>
          ))}
        </Field>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save plan'}</button>
        </div>
      </form>
    </Modal>
  );
}

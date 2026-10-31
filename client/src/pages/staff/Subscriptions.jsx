// Subscriptions — Staff & Admin.  Filterable list with keyset "load more", plus create.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subscriptions, plans, templates, products, customers } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { useCursorList } from '../../hooks/useCursorList.js';
import { DataTable } from '../../components/DataTable.jsx';
import { LineEditor } from '../../components/LineEditor.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { addDays, dateInput, formatDate, PERIOD_LABEL } from '../../lib/format.js';

const STATUSES = ['', 'DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED'];

// Plans can only be sold inside their availability window (the API enforces this too).
function planAvailable(p) {
  const now = new Date();
  return (!p.availableFrom || new Date(p.availableFrom) <= now) && (!p.availableTo || new Date(p.availableTo) >= now);
}

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [creating, setCreating] = useState(false);
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => customers.list({ limit: 200 }) });
  const list = useCursorList(['subscriptions', 'all'], subscriptions.list, {
    limit: 20, ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}), ...(customerId ? { customerId } : {}),
  });

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Draft → Quotation → Confirmed → Active. Active subscriptions are billed automatically."
        actions={can(user, 'subscription:create') && <button onClick={() => setCreating(true)}>+ New subscription</button>}
      />

      <Card
        bodyless
        title={
          <div className="tabs">
            {STATUSES.map((s) => (
              <button key={s} className={`tab ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
                {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All'}
              </button>
            ))}
          </div>
        }
      >
        <div className="card-body filters" style={{ borderBottom: '1px solid var(--border)', paddingBlock: 12 }}>
          <input className="search" placeholder="Search number, e.g. 42" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ width: 240 }}>
            <option value="">All customers</option>
            {(customersQ.data || []).map((c) => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
          </select>
        </div>
        <QueryState query={list} isEmpty={!list.rows.length} empty={<Empty title="No subscriptions">{status || q || customerId ? 'Nothing matches these filters.' : 'Create the first one to start billing.'}</Empty>}>
          <DataTable
            data={list.rows}
            onRowClick={(s) => navigate(`/subscriptions/${s._id}`)}
            columns={[
              { key: 'number', label: 'Number', render: (s) => <span className="strong">{s.number}</span> },
              { key: 'customer', label: 'Customer', render: (s) => <>{s.customerName || '—'}<div className="subtle">{s.customerEmail}</div></> },
              { key: 'plan', label: 'Plan', render: (s) => <>{s.planName || '—'}<div className="subtle">{PERIOD_LABEL[s.billingPeriod]}</div></> },
              { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
              { key: 'next', label: 'Next invoice', render: (s) => formatDate(s.nextInvoiceDate) },
              { key: 'mrr', label: 'Per month', align: 'right', render: (s) => <MoneyText amount={s.monthlyAmount} /> },
            ]}
          />
          {list.hasNextPage && (
            <div className="load-more"><button className="secondary sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? 'Loading…' : 'Load more'}</button></div>
          )}
        </QueryState>
      </Card>

      {creating && <CreateSubscription onClose={() => setCreating(false)} onCreated={(s) => navigate(`/subscriptions/${s._id}`)} />}
    </div>
  );
}

function CreateSubscription({ onClose, onCreated }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = new Date();
  const [form, setForm] = useState({
    customerId: '', planId: '', source: 'template', templateId: '', lines: [],
    startDate: dateInput(today), expiryDate: dateInput(addDays(today, 365)), paymentTermsDays: 30,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => customers.list({ limit: 200 }) });
  const plansQ = useQuery({ queryKey: ['plans'], queryFn: () => plans.list({ limit: 100 }) });
  const templatesQ = useQuery({ queryKey: ['templates'], queryFn: () => templates.list() });
  const productsQ = useQuery({ queryKey: ['products', 'all'], queryFn: () => products.list({ limit: 100 }) });

  const create = useMutation({
    mutationFn: subscriptions.create,
    onSuccess: (sub) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast(`${sub.number} created as a draft`);
      onCreated(sub);
    },
  });

  // Picking a template also picks its plan.
  const pickTemplate = (e) => {
    const t = templatesQ.data?.data.find((x) => x._id === e.target.value);
    setForm({ ...form, templateId: e.target.value, planId: t?.planId || form.planId });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      customerId: form.customerId,
      planId: form.planId,
      startDate: new Date(form.startDate).toISOString(),
      paymentTermsDays: Number(form.paymentTermsDays),
    };
    if (form.expiryDate) payload.expiryDate = new Date(form.expiryDate).toISOString();
    if (form.source === 'template') payload.templateId = form.templateId;
    else payload.lines = form.lines;
    create.mutate(payload);
  };

  const ready = form.customerId && form.planId && (form.source === 'template' ? form.templateId : form.lines.length);

  return (
    <Modal title="New subscription" onClose={onClose} wide>
      <ErrorAlert error={create.error} />
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Customer">
            <select value={form.customerId} onChange={set('customerId')} required>
              <option value="">{customersQ.isLoading ? 'Loading…' : 'Select customer…'}</option>
              {(customersQ.data || []).map((c) => (
                <option key={c._id} value={c._id}>{c.companyName || c.name} — {c.email}</option>
              ))}
            </select>
          </Field>
          <Field label="Plan">
            <select value={form.planId} onChange={set('planId')} required>
              <option value="">Select plan…</option>
              {(plansQ.data?.data || []).filter(planAvailable).map((p) => <option key={p._id} value={p._id}>{p.name} ({PERIOD_LABEL[p.billingPeriod]})</option>)}
            </select>
          </Field>
        </div>

        <Field label="Lines">
          <div className="tabs" style={{ marginBottom: 10 }}>
            <button type="button" className={`tab ${form.source === 'template' ? 'active' : ''}`} onClick={() => setForm({ ...form, source: 'template' })}>From a quotation template</button>
            <button type="button" className={`tab ${form.source === 'manual' ? 'active' : ''}`} onClick={() => setForm({ ...form, source: 'manual' })}>Pick products</button>
          </div>
          {form.source === 'template' ? (
            <select value={form.templateId} onChange={pickTemplate} required>
              <option value="">Select template…</option>
              {(templatesQ.data?.data || []).map((t) => <option key={t._id} value={t._id}>{t.name} ({t.lines?.length || 0} lines)</option>)}
            </select>
          ) : (
            <LineEditor products={productsQ.data?.data || []} value={form.lines} onChange={(lines) => setForm({ ...form, lines })} />
          )}
        </Field>

        <div className="form-grid">
          <Field label="Start date"><input type="date" value={form.startDate} onChange={set('startDate')} required /></Field>
          <Field label="Expiry date"><input type="date" value={form.expiryDate} onChange={set('expiryDate')} /></Field>
          <Field label="Payment terms (days)"><input type="number" min="0" value={form.paymentTermsDays} onChange={set('paymentTermsDays')} required /></Field>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!ready || create.isPending}>{create.isPending ? 'Creating…' : 'Create draft'}</button>
        </div>
      </form>
    </Modal>
  );
}

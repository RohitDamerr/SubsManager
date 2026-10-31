// Quotation templates — Admin & Staff create/edit.  A template is a plan + preset lines.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templates, plans, products } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { LineEditor } from '../../components/LineEditor.jsx';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { PERIOD_LABEL } from '../../lib/format.js';

export default function Templates() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(null); // null | 'new' | template
  const list = useQuery({ queryKey: ['templates'], queryFn: () => templates.list() });
  const plansQ = useQuery({ queryKey: ['plans'], queryFn: () => plans.list({ limit: 100 }) });
  const productsQ = useQuery({ queryKey: ['products', 'all'], queryFn: () => products.list({ limit: 100 }) });

  const planById = new Map((plansQ.data?.data || []).map((p) => [p._id, p]));
  const productById = new Map((productsQ.data?.data || []).map((p) => [p._id, p]));
  const rows = list.data?.data || [];
  const writable = can(user, 'template:write');

  return (
    <div>
      <PageHeader
        title="Quotation templates"
        subtitle="Reusable plan + product bundles for creating subscriptions quickly."
        actions={writable && <button onClick={() => setEditing('new')}>+ New template</button>}
      />
      <Card bodyless>
        <QueryState query={list} isEmpty={!rows.length} empty={<Empty title="No templates yet" />}>
          <DataTable
            data={rows}
            onRowClick={writable ? (t) => setEditing(t) : undefined}
            columns={[
              { key: 'name', label: 'Name', render: (t) => <span className="strong">{t.name}</span> },
              { key: 'plan', label: 'Plan', render: (t) => { const p = planById.get(t.planId); return p ? `${p.name} (${PERIOD_LABEL[p.billingPeriod]})` : '—'; } },
              { key: 'lines', label: 'Products', render: (t) => (t.lines || []).map((l, i) => <span key={i} className="chip">{productById.get(l.productId)?.name || 'Product'} × {l.quantity}</span>) },
              { key: 'validityDays', label: 'Valid for', render: (t) => `${t.validityDays} days` },
            ]}
          />
        </QueryState>
      </Card>

      {editing && (
        <TemplateForm
          template={editing === 'new' ? null : editing}
          plans={plansQ.data?.data || []}
          products={productsQ.data?.data || []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, plans: planList, products: productList, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: template?.name || '',
    planId: template?.planId || '',
    validityDays: template?.validityDays || 30,
    lines: (template?.lines || []).map((l) => ({ productId: l.productId, quantity: l.quantity, ...(l.variantId ? { variantId: l.variantId } : {}) })),
  });

  const save = useMutation({
    mutationFn: (b) => (template ? templates.update(template._id, b) : templates.create(b)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast(template ? 'Template updated' : 'Template created');
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    save.mutate({ ...form, validityDays: Number(form.validityDays) });
  };

  return (
    <Modal title={template ? `Edit ${template.name}` : 'New quotation template'} onClose={onClose} wide>
      <ErrorAlert error={save.error} />
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></Field>
          <Field label="Plan">
            <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} required>
              <option value="">Select plan…</option>
              {planList.map((p) => <option key={p._id} value={p._id}>{p.name} ({PERIOD_LABEL[p.billingPeriod]})</option>)}
            </select>
          </Field>
          <Field label="Quotation valid for (days)"><input type="number" min="1" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} required /></Field>
        </div>
        <Field label="Products">
          <LineEditor products={productList} value={form.lines} onChange={(lines) => setForm({ ...form, lines })} />
        </Field>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!form.lines.length || save.isPending}>{save.isPending ? 'Saving…' : 'Save template'}</button>
        </div>
      </form>
    </Modal>
  );
}

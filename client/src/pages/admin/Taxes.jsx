// Taxes — Admin create/edit, Staff read-only.  Rates are snapshotted onto subscription lines.
import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxes } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { can } from '../../auth/roles.js';
import { DataTable } from '../../components/DataTable.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function Taxes() {
  const { user } = useAuth();
  const writable = can(user, 'catalog:write');
  const [editing, setEditing] = useState(null);
  const [f, setF] = useUrlFilters({ q: '' });
  const list = useQuery({ queryKey: ['taxes', f.q], queryFn: () => taxes.list(compact(f)), placeholderData: keepPreviousData });
  const rows = list.data?.data || [];

  return (
    <div>
      <PageHeader
        title="Taxes"
        subtitle="Changing a rate affects new subscriptions only — existing lines keep their snapshot."
        actions={writable && <button onClick={() => setEditing('new')}>+ New tax</button>}
      />
      <Card bodyless>
        <div className="toolbar"><SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder="Search taxes" /></div>
        <QueryState query={list} isEmpty={!rows.length} empty={<Empty title={f.q ? `Nothing matches "${f.q}"` : 'No taxes yet'} />}>
          <DataTable
            data={rows}
            onRowClick={writable ? (t) => setEditing(t) : undefined}
            columns={[
              { key: 'name', label: 'Name', render: (t) => <span className="strong">{t.name}</span> },
              { key: 'rate', label: 'Rate', align: 'right', render: (t) => `${t.ratePercent}%` },
              { key: 'style', label: 'Style', render: (t) => (t.isInclusive ? 'Inclusive' : 'Exclusive') },
              { key: 'isActive', label: 'Status', render: (t) => <span className={`badge badge-${t.isActive ? 'green' : 'gray'}`}>{t.isActive ? 'Active' : 'Inactive'}</span> },
            ]}
          />
        </QueryState>
      </Card>
      {editing && <TaxForm tax={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TaxForm({ tax, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: tax?.name || '', ratePercent: tax?.ratePercent ?? 18, isInclusive: tax?.isInclusive ?? false, isActive: tax?.isActive ?? true,
  });
  const save = useMutation({
    mutationFn: (b) => (tax ? taxes.update(tax._id, b) : taxes.create(b)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxes'] }); toast(tax ? 'Tax updated' : 'Tax created'); onClose(); },
  });

  return (
    <Modal title={tax ? `Edit ${tax.name}` : 'New tax'} onClose={onClose}>
      <ErrorAlert error={save.error} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...form, ratePercent: Number(form.ratePercent) }); }}>
        <div className="form-grid">
          <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></Field>
          <Field label="Rate (%)"><input type="number" step="0.01" min="0" max="100" value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} required /></Field>
          <Field label="Style">
            <select value={String(form.isInclusive)} onChange={(e) => setForm({ ...form, isInclusive: e.target.value === 'true' })}>
              <option value="false">Exclusive (added on top)</option>
              <option value="true">Inclusive (inside the price)</option>
            </select>
          </Field>
        </div>
        <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={save.isPending}>Save tax</button>
        </div>
      </form>
    </Modal>
  );
}

// Staff — Admin only.  Lists team accounts and creates new Staff or Admin users.
import { useState } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { staff } from '../../api/resources.js';
import { DataTable } from '../../components/DataTable.jsx';
import { SearchInput } from '../../components/SearchInput.jsx';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { Card, Empty, ErrorAlert, Field, Modal, PageHeader, QueryState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { initials } from '../../lib/format.js';

export default function Staff() {
  const [creating, setCreating] = useState(false);
  const [f, setF] = useUrlFilters({ q: '' });
  const list = useQuery({ queryKey: ['staff', f.q], queryFn: () => staff.list(compact(f)), placeholderData: keepPreviousData });
  const rows = list.data || [];

  return (
    <div>
      <PageHeader title="Team" subtitle="Staff run subscriptions and invoices. Admins also manage the catalog, discounts and team." actions={<button onClick={() => setCreating(true)}>+ Add team member</button>} />
      <Card bodyless>
        <div className="toolbar"><SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder="Search name or email" /></div>
        <QueryState query={list} isEmpty={!rows.length} empty={<Empty title={f.q ? `Nothing matches "${f.q}"` : 'No team members'} />}>
          <DataTable
            data={rows}
            columns={[
              { key: 'name', label: 'Name', render: (u) => <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="avatar" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>{initials(u.name)}</span>{u.name}</span> },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role', render: (u) => <span className={`badge badge-${u.role === 'ADMIN' ? 'indigo' : 'blue'}`}>{u.role === 'ADMIN' ? 'Admin' : 'Staff'}</span> },
              { key: 'isActive', label: 'Status', render: (u) => <span className={`badge badge-${u.isActive ? 'green' : 'gray'}`}>{u.isActive ? 'Active' : 'Disabled'}</span> },
            ]}
          />
        </QueryState>
      </Card>
      {creating && <CreateStaff onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateStaff({ onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const create = useMutation({
    mutationFn: staff.create,
    onSuccess: (u) => { queryClient.invalidateQueries({ queryKey: ['staff'] }); toast(`${u.name} added`); onClose(); },
  });

  return (
    <Modal title="Add team member" onClose={onClose}>
      <ErrorAlert error={create.error} />
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
        <Field label="Name"><input value={form.name} onChange={set('name')} required autoFocus /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <div className="form-grid">
          <Field label="Temporary password" hint="8+ chars, upper, lower, special"><input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required /></Field>
          <Field label="Role">
            <select value={form.role} onChange={set('role')}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select>
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create account'}</button>
        </div>
      </form>
    </Modal>
  );
}

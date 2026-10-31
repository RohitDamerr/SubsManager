// Account — every role: profile summary and change password.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { auth as authApi } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABEL } from '../../auth/roles.js';
import { Card, ErrorAlert, Field, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => { toast('Password changed'); setForm({ currentPassword: '', newPassword: '' }); },
  });

  return (
    <div>
      <PageHeader title="Account" />
      <div className="grid-2">
        <Card title="Change password">
          <ErrorAlert error={change.error} />
          <form onSubmit={(e) => { e.preventDefault(); change.mutate(form); }} style={{ maxWidth: 380 }}>
            <Field label="Current password"><input type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></Field>
            <Field label="New password" hint="More than 8 characters, with upper and lower case and a special character.">
              <input type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
            </Field>
            <button type="submit" disabled={change.isPending}>{change.isPending ? 'Saving…' : 'Update password'}</button>
          </form>
        </Card>
        <Card title="Profile">
          <dl className="kv" style={{ gridTemplateColumns: '90px 1fr' }}>
            <dt>Name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Role</dt><dd>{ROLE_LABEL[user.role]}</dd>
            {user.customer?.companyName && <><dt>Company</dt><dd>{user.customer.companyName}</dd></>}
          </dl>
        </Card>
      </div>
    </div>
  );
}

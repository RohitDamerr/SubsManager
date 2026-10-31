// Payments register — Staff & Admin see all, customers see their own (server-scoped).
// Filter by date range and method; the total for the filter comes back with the first page.
import { useNavigate } from 'react-router-dom';
import { payments } from '../../api/resources.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLES } from '../../auth/roles.js';
import { useCursorList } from '../../hooks/useCursorList.js';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { SearchInput } from '../../components/SearchInput.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { DateRange } from '../../components/DateRange.jsx';
import { Card, Empty, PageHeader, QueryState } from '../../components/ui.jsx';
import { formatDate, formatMoney } from '../../lib/format.js';

export const METHOD_LABEL = { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', CARD: 'Card', UPI: 'UPI', CHEQUE: 'Cheque' };

export default function Payments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCustomer = user.role === ROLES.CUSTOMER;
  const [f, setF] = useUrlFilters({ q: '', method: '', from: '', to: '' });
  const list = useCursorList(['payments', 'register'], payments.register, { limit: 20, ...compact(f) });
  const filtered = Boolean(f.q || f.method || f.from || f.to);
  const summary = list.data?.pages[0]?.summary;

  return (
    <div>
      <PageHeader
        title={isCustomer ? 'My payments' : 'Payments'}
        subtitle={isCustomer ? 'Every payment we have received from you.' : 'Every payment recorded against an invoice.'}
      />

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Collected (filtered)</div><div className="kpi-value">{summary ? formatMoney(summary.total) : '…'}</div></div>
        <div className="kpi-card"><div className="kpi-label">Payments</div><div className="kpi-value">{summary ? summary.count : '…'}</div></div>
      </div>

      <Card bodyless>
        <div className="toolbar">
          <SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder={isCustomer ? 'Search invoice number' : 'Search invoice or customer'} />
          <select value={f.method} onChange={(e) => setF({ method: e.target.value })} style={{ width: 170 }}>
            <option value="">All methods</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <DateRange value={{ from: f.from, to: f.to }} onChange={(r) => setF(r)} />
          <span className="spacer" />
          {filtered && <button className="ghost sm" onClick={() => setF({ q: '', method: '', from: '', to: '' })}>Clear filters</button>}
        </div>
        <QueryState query={list} isEmpty={!list.rows.length} empty={<Empty title="No payments match these filters" />}>
          <DataTable
            data={list.rows}
            onRowClick={(p) => navigate(`/invoices/${p.invoiceId}`)}
            columns={[
              { key: 'paidOn', label: 'Date', render: (p) => formatDate(p.paidOn) },
              { key: 'invoice', label: 'Invoice', render: (p) => <span className="strong">{p.invoiceNumber || '—'}</span> },
              ...(isCustomer ? [] : [{ key: 'customer', label: 'Customer', render: (p) => p.customerName || '—' }]),
              { key: 'method', label: 'Method', render: (p) => METHOD_LABEL[p.method] || p.method },
              { key: 'note', label: 'Note', render: (p) => p.note || <span className="muted">—</span> },
              { key: 'amount', label: 'Amount', align: 'right', render: (p) => <MoneyText amount={p.amount} /> },
            ]}
          />
          {list.hasNextPage && (
            <div className="load-more"><button className="secondary sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>Load more</button></div>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

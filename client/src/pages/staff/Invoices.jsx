// Invoices — Staff & Admin.  Filter by status or overdue; filters live in the URL
// so dashboard links like /invoices?overdue=true land on the right view.
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invoices, customers } from '../../api/resources.js';
import { DateRange } from '../../components/DateRange.jsx';
import { useCursorList } from '../../hooks/useCursorList.js';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { SearchInput } from '../../components/SearchInput.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, PageHeader, QueryState } from '../../components/ui.jsx';
import { formatDate, isOverdue } from '../../lib/format.js';

const TABS = [
  ['', 'All'], ['DRAFT', 'Draft'], ['CONFIRMED', 'Confirmed'], ['overdue', 'Overdue'], ['PAID', 'Paid'], ['CANCELLED', 'Cancelled'],
];

export default function Invoices() {
  const navigate = useNavigate();
  const [f, setF] = useUrlFilters({ q: '', status: '', overdue: '', customerId: '', from: '', to: '' });
  const tab = f.overdue === 'true' ? 'overdue' : f.status;
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => customers.list({ limit: 200 }) });
  const list = useCursorList(['invoices', 'all'], invoices.list, { limit: 20, ...compact(f) });
  const filtered = Boolean(f.q || f.customerId || f.from || f.to);

  // Status and overdue are one tab group; the other filters are kept.
  const pick = (v) => setF(v === 'overdue' ? { overdue: 'true', status: '' } : { overdue: '', status: v });

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Drafts are created by the billing run. Confirm them to issue a number and collect payment." />
      <Card
        bodyless
        title={<div className="tabs">{TABS.map(([v, l]) => <button key={v} className={`tab ${tab === v ? 'active' : ''}`} onClick={() => pick(v)}>{l}</button>)}</div>}
      >
        <div className="toolbar">
          <SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder="Search number or customer" />
          <select value={f.customerId} onChange={(e) => setF({ customerId: e.target.value })} style={{ width: 220 }}>
            <option value="">All customers</option>
            {(customersQ.data || []).map((c) => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
          </select>
          <DateRange value={{ from: f.from, to: f.to }} onChange={(r) => setF(r)} presets={[['all', 'Any date'], ['month', 'This month'], ['lastMonth', 'Last month'], ['quarter', 'This quarter']]} />
          <span className="spacer" />
          {filtered && <button className="ghost sm" onClick={() => setF({ q: '', customerId: '', from: '', to: '' })}>Clear filters</button>}
        </div>
        <QueryState query={list} isEmpty={!list.rows.length} empty={<Empty title="No invoices here">{filtered || tab ? 'Nothing matches these filters.' : null}</Empty>}>
          <DataTable
            data={list.rows}
            onRowClick={(i) => navigate(`/invoices/${i._id}`)}
            columns={[
              { key: 'number', label: 'Invoice', render: (i) => <span className="strong">{i.number || 'Draft'}</span> },
              { key: 'customer', label: 'Customer', render: (i) => i.customerName || '—' },
              { key: 'issueDate', label: 'Issued', render: (i) => formatDate(i.issueDate) },
              { key: 'dueDate', label: 'Due', render: (i) => formatDate(i.dueDate) },
              { key: 'status', label: 'Status', render: (i) => <StatusBadge status={i.status} overdue={isOverdue(i)} /> },
              { key: 'total', label: 'Total', align: 'right', render: (i) => <MoneyText amount={i.total} /> },
              { key: 'paid', label: 'Paid', align: 'right', render: (i) => <MoneyText amount={i.amountPaid} /> },
            ]}
          />
          {list.hasNextPage && (
            <div className="load-more"><button className="secondary sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage ? 'Loading…' : 'Load more'}</button></div>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

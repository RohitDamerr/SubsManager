// Customer portal — my invoices (read + print).  Drafts are hidden by the server.
import { useNavigate } from 'react-router-dom';
import { invoices } from '../../api/resources.js';
import { useCursorList } from '../../hooks/useCursorList.js';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { SearchInput } from '../../components/SearchInput.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, PageHeader, QueryState } from '../../components/ui.jsx';
import { formatDate, isOverdue } from '../../lib/format.js';

const TABS = [['', 'All'], ['CONFIRMED', 'Unpaid'], ['PAID', 'Paid']];

export default function MyInvoices() {
  const navigate = useNavigate();
  const [f, setF] = useUrlFilters({ q: '', status: '' });
  const list = useCursorList(['invoices', 'mine'], invoices.list, { limit: 20, ...compact(f) });

  return (
    <div>
      <PageHeader title="My invoices" />
      <Card
        bodyless
        title={<div className="tabs">{TABS.map(([v, l]) => <button key={v} className={`tab ${f.status === v ? 'active' : ''}`} onClick={() => setF({ status: v })}>{l}</button>)}</div>}
      >
        <div className="toolbar"><SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder="Search invoice number" /></div>
        <QueryState query={list} isEmpty={!list.rows.length} empty={<Empty title="No invoices" />}>
          <DataTable
            data={list.rows}
            onRowClick={(i) => navigate(`/invoices/${i._id}`)}
            columns={[
              { key: 'number', label: 'Invoice', render: (i) => <span className="strong">{i.number}</span> },
              { key: 'period', label: 'Period', render: (i) => `${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}` },
              { key: 'dueDate', label: 'Due', render: (i) => formatDate(i.dueDate) },
              { key: 'status', label: 'Status', render: (i) => <StatusBadge status={i.status} overdue={isOverdue(i)} /> },
              { key: 'total', label: 'Total', align: 'right', render: (i) => <MoneyText amount={i.total} /> },
              { key: 'paid', label: 'Paid', align: 'right', render: (i) => <MoneyText amount={i.amountPaid} /> },
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

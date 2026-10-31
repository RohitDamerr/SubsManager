// Customer portal — my subscriptions.  Pause/close happen on the detail page,
// where the server tells us which transitions this plan allows.
import { useNavigate } from 'react-router-dom';
import { subscriptions } from '../../api/resources.js';
import { useCursorList } from '../../hooks/useCursorList.js';
import { compact, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { SearchInput } from '../../components/SearchInput.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { MoneyText } from '../../components/MoneyText.jsx';
import { Card, Empty, PageHeader, QueryState } from '../../components/ui.jsx';
import { formatDate, PERIOD_LABEL } from '../../lib/format.js';

export default function MySubscriptions() {
  const navigate = useNavigate();
  const [f, setF] = useUrlFilters({ q: '' });
  const list = useCursorList(['subscriptions', 'mine'], subscriptions.list, { limit: 20, ...compact(f) });

  return (
    <div>
      <PageHeader title="My subscriptions" subtitle="Open one to see its invoices, or to pause or close it." />
      <Card bodyless>
        <div className="toolbar"><SearchInput value={f.q} onChange={(q) => setF({ q })} placeholder="Search subscription number" /></div>
        <QueryState query={list} isEmpty={!list.rows.length} empty={<Empty title={f.q ? 'No matching subscriptions' : 'No subscriptions yet'}>{f.q ? null : 'Our team will set one up for you.'}</Empty>}>
          <DataTable
            data={list.rows}
            onRowClick={(s) => navigate(`/subscriptions/${s._id}`)}
            columns={[
              { key: 'number', label: 'Number', render: (s) => <span className="strong">{s.number}</span> },
              { key: 'planName', label: 'Plan', render: (s) => <>{s.planName || '—'} <span className="subtle">{PERIOD_LABEL[s.billingPeriod]}</span></> },
              { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s.status} /> },
              { key: 'next', label: 'Next invoice', render: (s) => formatDate(s.nextInvoiceDate) },
              { key: 'monthly', label: 'Per month', align: 'right', render: (s) => <MoneyText amount={s.monthlyAmount} /> },
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

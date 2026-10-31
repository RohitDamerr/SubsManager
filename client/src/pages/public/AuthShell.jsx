// Two-column frame shared by the public auth pages.
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="sidebar-brand" style={{ padding: 0 }}><span className="brand-mark">b</span>Brightloop</div>
        <div>
          <h1>Recurring billing without the spreadsheets.</h1>
          <p>Plans, subscriptions, invoices and payments in one place, for your team and your customers.</p>
          <ul>
            <li>Automatic invoices on every billing day</li>
            <li>Discounts and taxes applied for you</li>
            <li>A portal for customers to see their own bills</li>
          </ul>
        </div>
        <div className="subtle" style={{ color: '#a5b4fc' }}>© {new Date().getFullYear()} Brightloop</div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h2>{title}</h2>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

// App — all routes.  Every protected route lists its roles from ACCESS (auth/roles.js),
// the same table the sidebar is built from, so navigation and guards can't drift apart.
import { Routes, Route } from 'react-router-dom';
import { RequireAuth, PublicOnly, RoleHome } from './auth/ProtectedRoute.jsx';
import { ACCESS } from './auth/roles.js';
import { Layout } from './components/Layout.jsx';
import { NotFound } from './pages/Forbidden.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import ForgotPassword from './pages/public/ForgotPassword.jsx';
import ResetPassword from './pages/public/ResetPassword.jsx';
import Dashboard from './pages/dashboard/Dashboard.jsx';
import Products from './pages/admin/Products.jsx';
import Plans from './pages/admin/Plans.jsx';
import Taxes from './pages/admin/Taxes.jsx';
import Discounts from './pages/admin/Discounts.jsx';
import Staff from './pages/admin/Staff.jsx';
import Templates from './pages/staff/Templates.jsx';
import Subscriptions from './pages/staff/Subscriptions.jsx';
import SubscriptionDetail from './pages/staff/SubscriptionDetail.jsx';
import Invoices from './pages/staff/Invoices.jsx';
import InvoiceDetail from './pages/staff/InvoiceDetail.jsx';
import PortalHome from './pages/portal/PortalHome.jsx';
import MySubscriptions from './pages/portal/MySubscriptions.jsx';
import MyInvoices from './pages/portal/MyInvoices.jsx';
import Account from './pages/account/Account.jsx';

const guarded = (key, element) => ({ key, element });

const PAGES = [
  ['/dashboard', guarded('dashboard', <Dashboard />)],
  ['/portal', guarded('portal', <PortalHome />)],
  ['/subscriptions', guarded('subscriptions', <Subscriptions />)],
  ['/subscriptions/:id', guarded('subscriptionDetail', <SubscriptionDetail />)],
  ['/my-subscriptions', guarded('mySubscriptions', <MySubscriptions />)],
  ['/invoices', guarded('invoices', <Invoices />)],
  ['/invoices/:id', guarded('invoiceDetail', <InvoiceDetail />)],
  ['/my-invoices', guarded('myInvoices', <MyInvoices />)],
  ['/templates', guarded('templates', <Templates />)],
  ['/products', guarded('products', <Products />)],
  ['/plans', guarded('plans', <Plans />)],
  ['/taxes', guarded('taxes', <Taxes />)],
  ['/discounts', guarded('discounts', <Discounts />)],
  ['/staff', guarded('staff', <Staff />)],
  ['/account', guarded('account', <Account />)],
];

export default function App() {
  return (
    <Routes>
      {/* Public — signed-in users are bounced to their home */}
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      {/* Reset links must work even if someone else is signed in on this browser */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/" element={<RoleHome />} />

      {/* Protected — any signed-in user gets the layout; each page then checks its roles */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          {PAGES.map(([path, { key, element }]) => (
            <Route key={path} element={<RequireAuth roles={ACCESS[key]} />}>
              <Route path={path} element={element} />
            </Route>
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

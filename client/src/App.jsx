// App — all routes.  Public routes are standalone; protected routes use the Layout.
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { Layout } from './components/Layout.jsx';
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
import MySubscriptions from './pages/portal/MySubscriptions.jsx';
import MyInvoices from './pages/portal/MyInvoices.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected — shared layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* Dashboard — all roles */}
          <Route path="/" element={<Dashboard />} />

          {/* Customer portal */}
          <Route path="/my-subscriptions" element={<MySubscriptions />} />
          <Route path="/my-invoices" element={<MyInvoices />} />

          {/* Staff & Admin */}
          <Route element={<ProtectedRoute roles={['ADMIN', 'STAFF']} />}>
            <Route path="/templates" element={<Templates />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/subscriptions/:id" element={<SubscriptionDetail />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
          </Route>

          {/* Admin only */}
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/products" element={<Products />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/taxes" element={<Taxes />} />
            <Route path="/discounts" element={<Discounts />} />
            <Route path="/staff" element={<Staff />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

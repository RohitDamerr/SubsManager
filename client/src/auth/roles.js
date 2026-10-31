// RBAC on the client — one place that mirrors the server's role matrix.
// The server stays the source of truth; this only decides what to show and where to route.
import { matchPath } from 'react-router-dom';

export const ROLES = { ADMIN: 'ADMIN', STAFF: 'STAFF', CUSTOMER: 'CUSTOMER' };
const { ADMIN, STAFF, CUSTOMER } = ROLES;
const ALL = [ADMIN, STAFF, CUSTOMER];
const TEAM = [ADMIN, STAFF];

// Which roles may open which pages.  App.jsx guards routes with these lists.
export const ACCESS = {
  dashboard: TEAM,
  portal: [CUSTOMER],
  subscriptions: TEAM,          // full list; customers use /my-subscriptions
  mySubscriptions: [CUSTOMER],
  subscriptionDetail: ALL,      // server scopes customers to their own
  invoices: TEAM,
  myInvoices: [CUSTOMER],
  invoiceDetail: ALL,
  templates: TEAM,
  products: TEAM,               // staff read-only
  plans: TEAM,                  // staff read-only
  taxes: TEAM,                  // staff read-only
  discounts: TEAM,              // staff read-only
  staff: [ADMIN],
  account: ALL,
};

// Path pattern → access key, used to decide whether a post-login redirect is allowed.
const ROUTE_ACCESS = [
  ['/dashboard', 'dashboard'],
  ['/portal', 'portal'],
  ['/subscriptions', 'subscriptions'],
  ['/subscriptions/:id', 'subscriptionDetail'],
  ['/my-subscriptions', 'mySubscriptions'],
  ['/invoices', 'invoices'],
  ['/invoices/:id', 'invoiceDetail'],
  ['/my-invoices', 'myInvoices'],
  ['/templates', 'templates'],
  ['/products', 'products'],
  ['/plans', 'plans'],
  ['/taxes', 'taxes'],
  ['/discounts', 'discounts'],
  ['/staff', 'staff'],
  ['/account', 'account'],
];

// Action-level permissions (buttons, forms).  Mirrors section 3 of the architecture.
const PERMISSIONS = {
  'catalog:write': [ADMIN],          // products, variants, plans, taxes
  'catalog:viewCost': [ADMIN],       // cost price and margin
  'discount:write': [ADMIN],
  'template:write': TEAM,
  'subscription:create': TEAM,
  'invoice:manage': TEAM,            // confirm, cancel, send
  'payment:record': TEAM,
  'billing:run': [ADMIN],
  'staff:manage': [ADMIN],
};

export function can(user, permission) {
  return Boolean(user && PERMISSIONS[permission]?.includes(user.role));
}

export function hasRole(user, roles) {
  return Boolean(user && (!roles || roles.includes(user.role)));
}

/** Landing page for a role after login/register, or when hitting "/". */
export function homeFor(role) {
  return role === CUSTOMER ? '/portal' : '/dashboard';
}

/** True if `role` may open `pathname` — used to honour "return to where you were" safely. */
export function canAccessPath(role, pathname) {
  const hit = ROUTE_ACCESS.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  return Boolean(hit && ACCESS[hit[1]].includes(role));
}

// Sidebar, generated from the role.  `access` keys reuse ACCESS so nav and routes never disagree.
export const NAV = [
  { section: 'Overview' },
  { to: '/dashboard', label: 'Dashboard', icon: '▦', access: 'dashboard' },
  { to: '/portal', label: 'Overview', icon: '▦', access: 'portal' },
  { section: 'Billing' },
  { to: '/subscriptions', label: 'Subscriptions', icon: '↻', access: 'subscriptions' },
  { to: '/my-subscriptions', label: 'My Subscriptions', icon: '↻', access: 'mySubscriptions' },
  { to: '/invoices', label: 'Invoices', icon: '▤', access: 'invoices' },
  { to: '/my-invoices', label: 'My Invoices', icon: '▤', access: 'myInvoices' },
  { to: '/templates', label: 'Quotation Templates', icon: '❐', access: 'templates' },
  { section: 'Catalog' },
  { to: '/products', label: 'Products', icon: '◫', access: 'products' },
  { to: '/plans', label: 'Plans', icon: '◷', access: 'plans' },
  { to: '/taxes', label: 'Taxes', icon: '%', access: 'taxes' },
  { to: '/discounts', label: 'Discounts', icon: '✦', access: 'discounts' },
  { section: 'Admin' },
  { to: '/staff', label: 'Staff', icon: '◉', access: 'staff' },
];

/** Nav items for a role, dropping section headers that end up empty. */
export function navFor(role) {
  const out = [];
  for (const item of NAV) {
    if (item.section) out.push(item);
    else if (ACCESS[item.access].includes(role)) out.push(item);
  }
  return out.filter((item, i) => !item.section || (out[i + 1] && !out[i + 1].section));
}

export const ROLE_LABEL = { ADMIN: 'Admin', STAFF: 'Staff', CUSTOMER: 'Customer' };

// One API function per resource.  All use the shared axios instance.
// List calls return { data, nextCursor }; single-item calls return the item.
import api from './client.js';

const body = (r) => r.data.data;
const page = (r) => r.data;

// Auth
export const auth = {
  login: (b) => api.post('/auth/login', b).then(body),
  register: (b) => api.post('/auth/register', b).then(body),
  me: () => api.get('/auth/me').then(body),
  forgotPassword: (b) => api.post('/auth/forgot-password', b).then(body),
  resetPassword: (b) => api.post('/auth/reset-password', b).then(body),
  changePassword: (b) => api.post('/auth/change-password', b).then(body),
};

// Staff accounts (admin)
export const staff = {
  list: () => api.get('/users/staff').then(body),
  create: (b) => api.post('/users/staff', b).then(body),
};

// Customer directory (admin, staff)
export const customers = {
  list: (params) => api.get('/customers', { params }).then(body),
};

// Products
export const products = {
  list: (params) => api.get('/products', { params }).then(page),
  get: (id) => api.get(`/products/${id}`).then(body),
  create: (b) => api.post('/products', b).then(body),
  update: (id, b) => api.put(`/products/${id}`, b).then(body),
  addVariant: (id, b) => api.post(`/products/${id}/variants`, b).then(body),
};

// Plans
export const plans = {
  list: (params) => api.get('/plans', { params }).then(page),
  get: (id) => api.get(`/plans/${id}`).then(body),
  create: (b) => api.post('/plans', b).then(body),
  update: (id, b) => api.put(`/plans/${id}`, b).then(body),
};

// Taxes
export const taxes = {
  list: (params) => api.get('/taxes', { params }).then(page),
  create: (b) => api.post('/taxes', b).then(body),
  update: (id, b) => api.put(`/taxes/${id}`, b).then(body),
};

// Discounts
export const discounts = {
  list: (params) => api.get('/discounts', { params }).then(page),
  get: (id) => api.get(`/discounts/${id}`).then(body),
  create: (b) => api.post('/discounts', b).then(body),
  update: (id, b) => api.put(`/discounts/${id}`, b).then(body),
};

// Quotation templates
export const templates = {
  list: (params) => api.get('/quotation-templates', { params }).then(page),
  get: (id) => api.get(`/quotation-templates/${id}`).then(body),
  create: (b) => api.post('/quotation-templates', b).then(body),
  update: (id, b) => api.put(`/quotation-templates/${id}`, b).then(body),
};

// Subscriptions
export const subscriptions = {
  list: (params) => api.get('/subscriptions', { params }).then(page),
  get: (id) => api.get(`/subscriptions/${id}`).then(body),
  create: (b) => api.post('/subscriptions', b).then(body),
  transition: (id, to) => api.post(`/subscriptions/${id}/transition`, { to }).then(body),
};

// Invoices
export const invoices = {
  list: (params) => api.get('/invoices', { params }).then(page),
  get: (id) => api.get(`/invoices/${id}`).then(body),
  confirm: (id) => api.post(`/invoices/${id}/confirm`).then(body),
  cancel: (id) => api.post(`/invoices/${id}/cancel`).then(body),
  send: (id) => api.post(`/invoices/${id}/send`).then(body),
  // The print view needs the bearer token, so fetch it through axios rather than a plain link.
  printHtml: (id) => api.get(`/invoices/${id}/print`, { responseType: 'text' }).then((r) => r.data),
};

// Payments
export const payments = {
  list: (invoiceId) => api.get(`/invoices/${invoiceId}/payments`).then(body),
  record: (invoiceId, b) => api.post(`/invoices/${invoiceId}/payments`, b).then(body),
};

// Billing
export const billing = {
  run: () => api.post('/billing/run').then(body),
};

// Reports
export const reports = {
  summary: () => api.get('/reports/summary').then(body),
  revenue: (params) => api.get('/reports/revenue', { params }).then(body),
  overdue: (params) => api.get('/reports/overdue', { params }).then(body),
};

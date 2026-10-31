// One API function per resource.  All use the shared axios instance.
import api from './client.js';

// Auth
export const auth = {
  login: (body) => api.post('/auth/login', body).then((r) => r.data.data),
  register: (body) => api.post('/auth/register', body).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data),
  forgotPassword: (body) => api.post('/auth/forgot-password', body).then((r) => r.data.data),
  resetPassword: (body) => api.post('/auth/reset-password', body).then((r) => r.data.data),
  createStaff: (body) => api.post('/users/staff', body).then((r) => r.data.data),
};

// Products
export const products = {
  list: (params) => api.get('/products', { params }).then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data.data),
  create: (body) => api.post('/products', body).then((r) => r.data.data),
  update: (id, body) => api.put(`/products/${id}`, body).then((r) => r.data.data),
  addVariant: (id, body) => api.post(`/products/${id}/variants`, body).then((r) => r.data.data),
};

// Plans
export const plans = {
  list: (params) => api.get('/plans', { params }).then((r) => r.data),
  get: (id) => api.get(`/plans/${id}`).then((r) => r.data.data),
  create: (body) => api.post('/plans', body).then((r) => r.data.data),
  update: (id, body) => api.put(`/plans/${id}`, body).then((r) => r.data.data),
};

// Taxes
export const taxes = {
  list: (params) => api.get('/taxes', { params }).then((r) => r.data),
  create: (body) => api.post('/taxes', body).then((r) => r.data.data),
  update: (id, body) => api.put(`/taxes/${id}`, body).then((r) => r.data.data),
};

// Discounts
export const discounts = {
  list: (params) => api.get('/discounts', { params }).then((r) => r.data),
  get: (id) => api.get(`/discounts/${id}`).then((r) => r.data.data),
  create: (body) => api.post('/discounts', body).then((r) => r.data.data),
  update: (id, body) => api.put(`/discounts/${id}`, body).then((r) => r.data.data),
};

// Templates
export const templates = {
  list: (params) => api.get('/quotation-templates', { params }).then((r) => r.data),
  get: (id) => api.get(`/quotation-templates/${id}`).then((r) => r.data.data),
  create: (body) => api.post('/quotation-templates', body).then((r) => r.data.data),
  update: (id, body) => api.put(`/quotation-templates/${id}`, body).then((r) => r.data.data),
};

// Subscriptions
export const subscriptions = {
  list: (params) => api.get('/subscriptions', { params }).then((r) => r.data),
  get: (id) => api.get(`/subscriptions/${id}`).then((r) => r.data.data),
  create: (body) => api.post('/subscriptions', body).then((r) => r.data.data),
  transition: (id, to) => api.post(`/subscriptions/${id}/transition`, { to }).then((r) => r.data.data),
};

// Invoices
export const invoices = {
  list: (params) => api.get('/invoices', { params }).then((r) => r.data),
  get: (id) => api.get(`/invoices/${id}`).then((r) => r.data.data),
  confirm: (id) => api.post(`/invoices/${id}/confirm`).then((r) => r.data.data),
  cancel: (id) => api.post(`/invoices/${id}/cancel`).then((r) => r.data.data),
  send: (id) => api.post(`/invoices/${id}/send`).then((r) => r.data.data),
  printUrl: (id) => `/api/v1/invoices/${id}/print`,
};

// Payments
export const payments = {
  list: (invoiceId) => api.get(`/invoices/${invoiceId}/payments`).then((r) => r.data.data),
  record: (invoiceId, body) => api.post(`/invoices/${invoiceId}/payments`, body).then((r) => r.data.data),
};

// Billing
export const billing = {
  run: () => api.post('/billing/run').then((r) => r.data.data),
};

// Reports
export const reports = {
  summary: () => api.get('/reports/summary').then((r) => r.data.data),
  revenue: (params) => api.get('/reports/revenue', { params }).then((r) => r.data.data),
  overdue: (params) => api.get('/reports/overdue', { params }).then((r) => r.data.data),
};

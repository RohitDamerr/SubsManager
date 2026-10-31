// Express app setup — middleware, routes mounting, error handling.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp(routers) {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin, credentials: true }));

  // Body parsing
  app.use(express.json({ limit: '2mb' }));

  // Rate limiting on auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many requests, try again later' } },
  });

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // API v1 routes
  app.use('/api/v1/auth', authLimiter, routers.auth);
  app.use('/api/v1/users', authLimiter, routers.auth); // /users/staff lives here  app.use('/api/v1/products', routers.products);
  app.use('/api/v1/plans', routers.plans);
  app.use('/api/v1/taxes', routers.taxes);
  app.use('/api/v1/discounts', routers.discounts);
  app.use('/api/v1/quotation-templates', routers.templates);
  app.use('/api/v1/subscriptions', routers.subscriptions);
  app.use('/api/v1/invoices', routers.invoices);
  app.use('/api/v1/invoices', routers.payments); // nested /:id/payments
  app.use('/api/v1/billing', routers.billing);
  app.use('/api/v1/reports', routers.reports);

  // 404 + error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

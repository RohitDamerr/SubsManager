// Dependency injection container — constructor injection, no framework.
// All repositories and services are wired here once at startup.
import { getDb, getClient } from '../config/mongo.js';
import { TransactionManager } from '../core/TransactionManager.js';
import { EventBus } from '../events/EventBus.js';
import { Mailer } from '../modules/auth/Mailer.js';
import { UserRepository } from '../modules/auth/UserRepository.js';
import { CustomerRepository } from '../modules/auth/CustomerRepository.js';
import { AuthService } from '../modules/auth/AuthService.js';
import { AuthController } from '../modules/auth/AuthController.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { ProductRepository } from '../modules/catalog/ProductRepository.js';
import { ProductService } from '../modules/catalog/ProductService.js';
import { ProductController } from '../modules/catalog/ProductController.js';
import { createProductRouter } from '../modules/catalog/product.routes.js';
import { PlanRepository } from '../modules/catalog/PlanRepository.js';
import { PlanService } from '../modules/catalog/PlanService.js';
import { PlanController } from '../modules/catalog/PlanController.js';
import { createPlanRouter } from '../modules/catalog/plan.routes.js';
import { TaxRepository } from '../modules/tax/TaxRepository.js';
import { TaxEngine } from '../modules/tax/TaxEngine.js';
import { TaxController } from '../modules/tax/TaxController.js';
import { createTaxRouter } from '../modules/tax/tax.routes.js';
import { DiscountRepository } from '../modules/discount/DiscountRepository.js';
import { DiscountService } from '../modules/discount/DiscountService.js';
import { DiscountEngine } from '../modules/discount/DiscountEngine.js';
import { DiscountController } from '../modules/discount/DiscountController.js';
import { createDiscountRouter } from '../modules/discount/discount.routes.js';
import { QuotationTemplateRepository } from '../modules/template/QuotationTemplateRepository.js';
import { QuotationTemplateService } from '../modules/template/QuotationTemplateService.js';
import { QuotationTemplateController } from '../modules/template/QuotationTemplateController.js';
import { createTemplateRouter } from '../modules/template/template.routes.js';
import { SubscriptionRepository } from '../modules/subscription/SubscriptionRepository.js';
import { SubscriptionStateMachine } from '../modules/subscription/SubscriptionStateMachine.js';
import { SubscriptionService } from '../modules/subscription/SubscriptionService.js';
import { SubscriptionController } from '../modules/subscription/SubscriptionController.js';
import { createSubscriptionRouter } from '../modules/subscription/subscription.routes.js';
import { InvoiceRepository } from '../modules/invoice/InvoiceRepository.js';
import { InvoiceStateMachine } from '../modules/invoice/InvoiceStateMachine.js';
import { InvoiceBuilder } from '../modules/invoice/InvoiceBuilder.js';
import { InvoiceService } from '../modules/invoice/InvoiceService.js';
import { InvoiceController } from '../modules/invoice/InvoiceController.js';
import { createInvoiceRouter } from '../modules/invoice/invoice.routes.js';
import { PaymentRepository } from '../modules/payment/PaymentRepository.js';
import { PaymentService } from '../modules/payment/PaymentService.js';
import { PaymentController } from '../modules/payment/PaymentController.js';
import { createPaymentRouter } from '../modules/payment/payment.routes.js';
import { BillingLock } from '../modules/billing/BillingLock.js';
import { BillingService } from '../modules/billing/BillingService.js';
import { BillingController } from '../modules/billing/BillingController.js';
import { createBillingRouter } from '../modules/billing/billing.routes.js';
import { BillingScheduler } from '../modules/billing/BillingScheduler.js';
import { ReportRepository } from '../modules/report/ReportRepository.js';
import { ReportService } from '../modules/report/ReportService.js';
import { ReportController } from '../modules/report/ReportController.js';
import { createReportRouter } from '../modules/report/report.routes.js';

export function buildContainer() {
  const db = getDb();
  const client = getClient();

  // Core infra
  const txManager = new TransactionManager(client);
  const eventBus = new EventBus();
  const mailer = new Mailer();

  // Repositories
  const userRepo = new UserRepository(db);
  const customerRepo = new CustomerRepository(db);
  const productRepo = new ProductRepository(db);
  const planRepo = new PlanRepository(db);
  const taxRepo = new TaxRepository(db);
  const discountRepo = new DiscountRepository(db);
  const templateRepo = new QuotationTemplateRepository(db);
  const subscriptionRepo = new SubscriptionRepository(db);
  const invoiceRepo = new InvoiceRepository(db);
  const paymentRepo = new PaymentRepository(db);
  const reportRepo = new ReportRepository(db);

  // Engines
  const taxEngine = new TaxEngine();
  const discountEngineFactory = (activeDiscounts) => new DiscountEngine(activeDiscounts);
  const invoiceBuilder = new InvoiceBuilder({ taxEngine, discountEngineFactory });
  const subscriptionStateMachine = new SubscriptionStateMachine();
  const invoiceStateMachine = new InvoiceStateMachine();

  // Services
  const authService = new AuthService({ userRepo, customerRepo, txManager, mailer, eventBus });
  const productService = new ProductService({ productRepo });
  const planService = new PlanService({ planRepo });
  const discountService = new DiscountService({ discountRepo, txManager });
  const templateService = new QuotationTemplateService({ templateRepo });
  const subscriptionService = new SubscriptionService({
    subscriptionRepo, planRepo, templateRepo, productRepo, taxRepo, customerRepo, invoiceRepo,
    txManager, eventBus, subscriptionStateMachine,
  });
  const invoiceService = new InvoiceService({
    invoiceRepo, subscriptionRepo, discountRepo, customerRepo, userRepo, txManager, eventBus, invoiceStateMachine, mailer,
  });
  const paymentService = new PaymentService({
    paymentRepo, invoiceRepo, customerRepo, txManager, eventBus,
  });
  const billingLock = new BillingLock(db);
  const billingService = new BillingService({
    subscriptionRepo, invoiceRepo, discountRepo, customerRepo, invoiceBuilder,
    txManager, billingLock, planRepo,
  });
  const reportService = new ReportService({ reportRepo });

  // Controllers
  const authController = new AuthController({ authService });
  const productController = new ProductController({ productService });
  const planController = new PlanController({ planService });
  const taxController = new TaxController({ taxRepo });
  const discountController = new DiscountController({ discountService });
  const templateController = new QuotationTemplateController({ templateService });
  const subscriptionController = new SubscriptionController({ subscriptionService });
  const invoiceController = new InvoiceController({ invoiceService });
  const paymentController = new PaymentController({ paymentService });
  const billingController = new BillingController({ billingService });
  const reportController = new ReportController({ reportService });

  // Routers
  const routers = {
    auth: createAuthRouter({ authController }),
    products: createProductRouter({ productController }),
    plans: createPlanRouter({ planController }),
    taxes: createTaxRouter({ taxController }),
    discounts: createDiscountRouter({ discountController }),
    templates: createTemplateRouter({ templateController }),
    subscriptions: createSubscriptionRouter({ subscriptionController }),
    invoices: createInvoiceRouter({ invoiceController }),
    payments: createPaymentRouter({ paymentController }),
    billing: createBillingRouter({ billingController }),
    reports: createReportRouter({ reportController }),
  };

  // Scheduler
  const scheduler = new BillingScheduler(billingService);

  return { routers, scheduler, eventBus, mailer };
}

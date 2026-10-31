// InvoiceController — HTTP layer for invoices.
import { BaseController, asyncHandler } from '../../core/BaseController.js';
import { encodeCursor } from '../../core/Pagination.js';

export class InvoiceController extends BaseController {
  constructor({ invoiceService }) {
    super();
    this.invoiceService = invoiceService;
  }

  list = asyncHandler(async (req, res) => {
    const { data, hasMore } = await this.invoiceService.list(req.query, req.user);
    const nextCursor = hasMore && data.length
      ? encodeCursor(data[data.length - 1], 'issueDate')
      : null;
    return this.paginated(res, data, nextCursor);
  });

  getById = asyncHandler(async (req, res) => {
    const invoice = await this.invoiceService.getById(req.params.id, req.user);
    return this.ok(res, invoice);
  });

  confirm = asyncHandler(async (req, res) => {
    const invoice = await this.invoiceService.confirm(req.params.id, req.user);
    return this.ok(res, invoice);
  });

  cancel = asyncHandler(async (req, res) => {
    const invoice = await this.invoiceService.cancel(req.params.id, req.user);
    return this.ok(res, invoice);
  });

  send = asyncHandler(async (req, res) => {
    const invoice = await this.invoiceService.send(req.params.id, req.user);
    return this.ok(res, invoice);
  });

  print = asyncHandler(async (req, res) => {
    const invoice = await this.invoiceService.getById(req.params.id, req.user);
    const html = this.invoiceService.buildPrintHTML(invoice);
    res.set('Content-Type', 'text/html');
    return res.send(html);
  });
}

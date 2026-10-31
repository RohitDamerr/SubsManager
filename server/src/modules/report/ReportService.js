// ReportService — runs dashboard aggregations in parallel with Promise.all.
export class ReportService {
  constructor({ reportRepo }) {
    this.reportRepo = reportRepo;
  }

  async summary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [activeSubscriptions, outstanding, overdueCount, mrr, revenueThisMonth] = await Promise.all([
      this.reportRepo.activeSubscriptions(),
      this.reportRepo.outstanding(),
      this.reportRepo.overdueCount(),
      this.reportRepo.mrr(),
      this.reportRepo.revenueReceived(monthStart, now),
    ]);

    return { activeSubscriptions, outstanding, overdueCount, mrr, revenueThisMonth };
  }

  async revenue({ from, to, groupBy }) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    // A bare date for "to" means the whole of that day.
    const toDate = to ? new Date(new Date(to).getTime() + (/^\d{4}-\d{2}-\d{2}$/.test(to) ? 24 * 60 * 60 * 1000 - 1 : 0)) : new Date();
    const [total, series, byMethod] = await Promise.all([
      this.reportRepo.revenueReceived(fromDate, toDate),
      this.reportRepo.revenueSeries(fromDate, toDate, groupBy),
      this.reportRepo.revenueByMethod(fromDate, toDate),
    ]);
    return { total, series, byMethod };
  }

  async overdue({ limit } = {}) {
    return this.reportRepo.overdue({ limit: Number(limit) || 50 });
  }
}

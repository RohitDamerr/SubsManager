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
    const toDate = to ? new Date(to) : new Date();
    const [total, series] = await Promise.all([
      this.reportRepo.revenueReceived(fromDate, toDate),
      this.reportRepo.revenueSeries(fromDate, toDate, groupBy),
    ]);
    return { total, series };
  }

  async overdue({ limit } = {}) {
    return this.reportRepo.overdue({ limit: Number(limit) || 50 });
  }
}

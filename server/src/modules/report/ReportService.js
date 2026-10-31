// ReportService — runs dashboard aggregations in parallel with Promise.all.
export class ReportService {
  constructor({ reportRepo }) {
    this.reportRepo = reportRepo;
  }

  async summary() {
    const [activeSubscriptions, outstanding, overdue, mrr] = await Promise.all([
      this.reportRepo.activeSubscriptions(),
      this.reportRepo.outstanding(),
      this.reportRepo.overdue({ limit: 10 }),
      this.reportRepo.mrr(),
    ]);

    return {
      activeSubscriptions,
      outstanding,
      overdueCount: overdue.length,
      mrr,
    };
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

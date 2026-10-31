// BillingScheduler — node-cron inside the API process.
// Nightly billing at 02:00 and maintenance tasks.
import cron from 'node-cron';

export class BillingScheduler {
  constructor(billingService) {
    this.billingService = billingService;
    this.jobs = [];
  }

  start() {
    // Nightly billing run at 02:00.
    const billingJob = cron.schedule('0 2 * * *', async () => {
      console.log('[scheduler] running nightly billing');
      try {
        const result = await this.billingService.run();
        console.log('[scheduler] billing complete:', result);
      } catch (err) {
        console.error('[scheduler] billing failed:', err);
      }
    });
    this.jobs.push(billingJob);
  }

  stop() {
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }
}

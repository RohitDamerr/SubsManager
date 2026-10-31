// Mailer — nodemailer wrapper.  Falls back to Ethereal in dev when SMTP is unset.
import nodemailer from 'nodemailer';
import { config } from '../../config/env.js';

export class Mailer {
  constructor() {
    this.transporter = null;
    this.dev = false;
  }

  async init() {
    if (!config.smtp.host) {
      // Use Ethereal test account in dev — safe preview, no real email sent.
      const test = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: test.user, pass: test.pass },
      });
      this.dev = true;
      console.log('[mailer] using Ethereal test account:', test.user);
    } else {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
    }
  }

  async send({ to, subject, text, html }) {
    if (!this.transporter) await this.init();
    const info = await this.transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    });
    if (this.dev) {
      console.log(`[mailer] preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  }
}

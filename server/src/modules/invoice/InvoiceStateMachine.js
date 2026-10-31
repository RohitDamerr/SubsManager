// InvoiceStateMachine — DRAFT → CONFIRMED → PAID, plus CANCELLED.
import { StateMachine } from '../../core/StateMachine.js';

export class InvoiceStateMachine extends StateMachine {
  constructor() {
    super({
      DRAFT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PAID', 'CANCELLED'],
      PAID: [],
      CANCELLED: [],
    }, 'Invoice');
  }
}

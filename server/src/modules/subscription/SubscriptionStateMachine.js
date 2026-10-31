// SubscriptionStateMachine — DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED
// Extra transitions depend on plan flags.
import { StateMachine } from '../../core/StateMachine.js';
import { ValidationError } from '../../core/AppError.js';

export class SubscriptionStateMachine extends StateMachine {
  constructor() {
    super({
      DRAFT: ['QUOTATION', 'CONFIRMED'],
      QUOTATION: ['CONFIRMED', 'DRAFT'],
      CONFIRMED: ['ACTIVE'],
      ACTIVE: ['PAUSED', 'CLOSED'],
      PAUSED: ['ACTIVE', 'CLOSED'],
      CLOSED: [],
    }, 'Subscription');
  }

  /**
   * Assert that a transition is allowed, considering plan flags and actor role.
   * @param {string} from
   * @param {string} to
   * @param {object} plan - { allowPause, allowEarlyClose }
   * @param {object} actor - { role }
   */
  assertCanTransition(from, to, plan = {}, actor = {}) {
    // Base transition check
    this.assertCan(from, to);

    // Plan-gated transitions
    if (to === 'PAUSED' && from === 'ACTIVE' && plan.allowPause === false) {
      throw new ValidationError('This plan does not allow pausing');
    }
    if (to === 'CLOSED' && from === 'ACTIVE' && plan.allowEarlyClose === false) {
      throw new ValidationError('This plan does not allow early closure');
    }

    // Customer can only pause or close their own subscription (enforced in service).
    if (actor.role === 'CUSTOMER' && !['PAUSED', 'CLOSED'].includes(to)) {
      throw new ValidationError('Customers can only pause or close subscriptions');
    }
  }

  /** Target states this actor may move to from `from` — lets the UI show only valid actions. */
  allowedTransitions(from, plan = {}, actor = {}) {
    return this.nextStates(from).filter((to) => {
      try {
        this.assertCanTransition(from, to, plan, actor);
        return true;
      } catch {
        return false;
      }
    });
  }
}

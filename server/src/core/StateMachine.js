// Generic state machine — configured with an allowed-transitions map.
// Illegal transitions throw ValidationError.

import { ValidationError } from './AppError.js';

export class StateMachine {
  /**
   * @param {Record<string, string[]>} transitions - { from: [to, to, ...] }
   * @param {string} [name] - label for error messages
   */
  constructor(transitions, name = 'Entity') {
    this.transitions = transitions;
    this.name = name;
  }

  canTransition(from, to) {
    return (this.transitions[from] || []).includes(to);
  }

  assertCan(from, to) {
    if (!this.canTransition(from, to)) {
      throw new ValidationError(
        `Invalid ${this.name} transition: ${from} -> ${to}. Allowed: ${(this.transitions[from] || []).join(', ') || 'none'}`
      );
    }
  }

  /** All states reachable from the given state. */
  nextStates(from) {
    return this.transitions[from] || [];
  }
}

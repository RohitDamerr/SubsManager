// Password policy — one rule object, reused by register and reset-password.
// Requires length > 8, at least one uppercase, one lowercase, one special character.

import { ValidationError } from '../../core/AppError.js';

export class PasswordPolicy {
  /**
   * Validate a plaintext password.
   * @param {string} pw
   * @returns {{ valid: boolean, reason?: string }}
   */
  static validate(pw) {
    if (!pw || typeof pw !== 'string') return { valid: false, reason: 'Password is required' };
    if (pw.length <= 8) return { valid: false, reason: 'Password must be longer than 8 characters' };
    if (!/[A-Z]/.test(pw)) return { valid: false, reason: 'Password must contain an uppercase letter' };
    if (!/[a-z]/.test(pw)) return { valid: false, reason: 'Password must contain a lowercase letter' };
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw)) {
      return { valid: false, reason: 'Password must contain a special character' };
    }
    return { valid: true };
  }

  /** Throw a ValidationError if the password fails. */
  static assert(pw) {
    const { valid, reason } = PasswordPolicy.validate(pw);
    if (!valid) {
      throw new ValidationError(reason);
    }
  }
}

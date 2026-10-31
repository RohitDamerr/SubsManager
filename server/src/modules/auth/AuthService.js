// AuthService — business rules for registration, login, password reset, staff creation.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config/env.js';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  translateMongoError,
} from '../../core/AppError.js';
import { PasswordPolicy } from './PasswordPolicy.js';

export class AuthService {
  /**
   * @param {{ userRepo: UserRepository, customerRepo: CustomerRepository, txManager: TransactionManager, mailer: Mailer, eventBus: EventBus }} deps
   */
  constructor({ userRepo, customerRepo, txManager, mailer, eventBus }) {
    this.userRepo = userRepo;
    this.customerRepo = customerRepo;
    this.txManager = txManager;
    this.mailer = mailer;
    this.eventBus = eventBus;
  }

  async register({ email, password, name, companyName, phone, billingAddress }) {
    PasswordPolicy.assert(password);
    email = email.toLowerCase();

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // Rely on the unique index for dup detection (check-then-insert is racy).
    let user;
    try {
      user = await this.userRepo.create({ email, passwordHash, name, role: 'CUSTOMER' });
    } catch (err) {
      const translated = translateMongoError(err, { email: 'Email already registered' });
      if (translated instanceof ConflictError) throw translated;
      throw err;
    }

    // Create the customer profile in the same transaction.
    await this.txManager.run(async (session) => {
      await this.customerRepo.create(
        { userId: user._id, companyName, phone, billingAddress },
        { session }
      );
    });

    const token = this.signToken(user);
    this.eventBus.emit('user.registered', { user });
    return { user, token };
  }

  async login({ email, password }) {
    email = email.toLowerCase();
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedError('Invalid email or password');

    const token = this.signToken(user);
    return { user, token };
  }

  async getCurrentUser(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    const customer = await this.customerRepo.findByUserId(userId);
    return { ...user, customer };
  }

  async createStaff({ email, password, name, role }, actor) {
    if (actor.role !== 'ADMIN') throw new ForbiddenError('Only admins can create staff accounts');
    if (!['STAFF', 'ADMIN'].includes(role)) throw new ValidationError('Invalid staff role');
    PasswordPolicy.assert(password);

    email = email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    try {
      return await this.userRepo.create({ email, passwordHash, name, role });
    } catch (err) {
      const translated = translateMongoError(err, { email: 'Email already registered' });
      if (translated instanceof ConflictError) throw translated;
      throw err;
    }
  }

  async forgotPassword(email) {
    email = email.toLowerCase();
    const user = await this.userRepo.findByEmail(email);

    // Always return 200 — don't reveal whether the email exists.
    if (!user) return { sent: true };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.userRepo.setResetToken(user._id, { hash, expiresAt });

    // Best-effort email — failure doesn't leak to the client.
    try {
      await this.mailer.send({
        to: user.email,
        subject: 'Password Reset — Brightloop',
        text: `Reset your password: ${config.cors.origin}/reset-password?token=${rawToken}`,
      });
    } catch (err) {
      console.error('[auth] reset email failed:', err.message);
    }

    return { sent: true };
  }

  async resetPassword({ token, password }) {
    PasswordPolicy.assert(password);
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepo.findByResetTokenHash(hash);
    if (!user) throw new ValidationError('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    await this.txManager.run(async (session) => {
      await this.userRepo.updatePassword(user._id, passwordHash, { session });
      await this.userRepo.markTokenUsed(user._id, { session });
    });

    return { user };
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    PasswordPolicy.assert(newPassword);
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User');
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new UnauthorizedError('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await this.userRepo.updatePassword(userId, passwordHash);
    return { user };
  }

  signToken(user) {
    return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }
}

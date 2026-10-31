// AuthController — thin HTTP layer over AuthService.
import { BaseController, asyncHandler } from '../../core/BaseController.js';

export class AuthController extends BaseController {
  constructor({ authService }) {
    super();
    this.authService = authService;
  }

  register = asyncHandler(async (req, res) => {
    const { user, token } = await this.authService.register(req.body);
    return this.created(res, {
      user: this.publicUser(user),
      token,
    });
  });

  login = asyncHandler(async (req, res) => {
    const { user, token } = await this.authService.login(req.body);
    return this.ok(res, {
      user: this.publicUser(user),
      token,
    });
  });

  me = asyncHandler(async (req, res) => {
    const user = await this.authService.getCurrentUser(req.user._id);
    return this.ok(res, this.publicUser(user));
  });

  createStaff = asyncHandler(async (req, res) => {
    const user = await this.authService.createStaff(req.body, req.user);
    return this.created(res, this.publicUser(user));
  });

  forgotPassword = asyncHandler(async (req, res) => {
    await this.authService.forgotPassword(req.body.email);
    return this.ok(res, { sent: true });
  });

  resetPassword = asyncHandler(async (req, res) => {
    await this.authService.resetPassword(req.body);
    return this.ok(res, { reset: true });
  });

  changePassword = asyncHandler(async (req, res) => {
    await this.authService.changePassword(req.user._id, req.body);
    return this.ok(res, { changed: true });
  });

  // Strip sensitive fields.
  publicUser(user) {
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      customer: user.customer || null,
    };
  }
}

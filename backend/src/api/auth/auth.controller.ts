/**
 * AuthController — Authentication APIs.
 * POST /auth/login · POST /auth/logout · POST /auth/refresh · POST /auth/reset-password
 * There is deliberately no public registration: administrators create users
 * through POST /users/admin/users (permission admin.user).
 * Reference: API Spec (DOC-10) §3.3
 */
import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../../application/auth.service';
import { LoginRequestDto, RefreshRequestDto, ResetPasswordRequestDto } from '../dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginRequestDto) {
    return this.auth.login({ username: dto.username, password: dto.password });
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization: string) {
    const token = (authorization ?? '').replace(/^Bearer /, '');
    await this.auth.logout(token);
    return { message: 'logged_out' };
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshRequestDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordRequestDto) {
    return this.auth.completePasswordReset(dto.resetToken, dto.newPassword);
  }
}

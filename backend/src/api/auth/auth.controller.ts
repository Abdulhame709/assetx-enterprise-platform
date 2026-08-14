/**
 * AuthController — Authentication APIs.
 * POST /auth/register · POST /auth/login · POST /auth/logout
 * POST /auth/refresh · POST /auth/reset-password
 * Reference: API Spec (DOC-10) §3.3
 */
import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AuthService } from '../../application/auth.service';
import { LoginRequestDto, RefreshRequestDto, RegisterRequestDto, ResetPasswordRequestDto } from '../dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterRequestDto) {
    return this.auth.register({
      tenantId: dto.tenantId ?? '',
      username: dto.username,
      email: dto.email,
      password: dto.password,
    });
  }

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

  @Post('refresh')
  async refresh(@Body() dto: RefreshRequestDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordRequestDto) {
    return this.auth.completePasswordReset(dto.resetToken, dto.newPassword);
  }
}

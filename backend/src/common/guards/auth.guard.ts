/**
 * AuthGuard — validates the JWT access token and attaches the user to the request.
 * Reference: Security Architecture (DOC-13) · API Spec auth endpoints
 */
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { TokenManager, TokenPayload } from '../../core/ports/auth.port';
import { TOKEN_MANAGER } from '../../core/ports/tokens';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_MANAGER) private readonly tokens: TokenManager) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new Error('UNAUTHORIZED');
    try {
      const payload: TokenPayload = this.tokens.verifyAccessToken(token);
      req.user = {
        sub: payload.sub,
        username: payload.username,
        tenant_id: payload.tenant_id,
        role: payload.role,
        session_id: payload.session_id,
      };
      return true;
    } catch {
      throw new Error('UNAUTHORIZED');
    }
  }
}

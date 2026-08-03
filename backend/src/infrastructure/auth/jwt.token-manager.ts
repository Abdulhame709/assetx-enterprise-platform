/**
 * JwtTokenManager — TokenManager implementation (jsonwebtoken).
 * Access token: 15 min · Refresh token: 7 days (AAB §11B / NFR-SEC-005).
 * Reference: Security Architecture (DOC-13) §4.1
 */
import * as jwt from 'jsonwebtoken';
import { TokenManager, TokenPayload } from '../../core/ports/auth.port';

export class JwtTokenManager implements TokenManager {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessTtl = '15m',
    private readonly refreshTtl = '7d',
  ) {}

  private sign(payload: TokenPayload, secret: string, ttl: string): string {
    return jwt.sign({ ...payload }, secret, { expiresIn: ttl } as jwt.SignOptions);
  }

  signAccessToken(payload: TokenPayload): string {
    return this.sign(payload, this.accessSecret, this.accessTtl);
  }
  signRefreshToken(payload: TokenPayload): string {
    return this.sign(payload, this.refreshSecret, this.refreshTtl);
  }

  private verify(token: string, secret: string): TokenPayload {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  }
  verifyAccessToken(token: string): TokenPayload {
    return this.verify(token, this.accessSecret);
  }
  verifyRefreshToken(token: string): TokenPayload {
    return this.verify(token, this.refreshSecret);
  }
  decode(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}

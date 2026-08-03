/**
 * Auth domain ports — abstract password hashing and token management.
 */

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface TokenManager {
  signAccessToken(payload: TokenPayload): string;
  signRefreshToken(payload: TokenPayload): string;
  verifyAccessToken(token: string): TokenPayload;
  verifyRefreshToken(token: string): TokenPayload;
  /** Decode without verification (for expired-token inspection). */
  decode(token: string): TokenPayload | null;
}

export interface TokenPayload {
  sub: string;       // user id
  username: string;
  tenant_id: string;
  role: string;
  session_id: string;
}

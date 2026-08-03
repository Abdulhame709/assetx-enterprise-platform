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
  role: string;                 // primary role (legacy RBAC)
  roles: string[];              // all roles (Phase 9)
  permissions: string[];        // flat permission keys (Phase 9)
  permission_version: number;   // permission version (Phase 9.5)
  session_id: string;
}

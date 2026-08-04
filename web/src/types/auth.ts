/**
 * Auth & session types for the AssetX frontend shell.
 * Mirrors the backend auth contract (JWT access/refresh + permission version).
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  roles: string[];
}

export interface TenantContext {
  id: string;
  name: string;
  code: string;
}

export interface Session {
  user: UserProfile;
  tenant: TenantContext;
  /** flat permission set from the backend permission matrix */
  permissions: string[];
  accessToken: string;
  refreshToken?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: UserProfile;
  tenant: TenantContext;
  permissions: string[];
}

export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated' | 'loading';

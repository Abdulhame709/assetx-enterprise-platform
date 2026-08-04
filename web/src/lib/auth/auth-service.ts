/**
 * AuthService — real authentication against the AssetX backend.
 * Used in production; the session provider falls back to mockLogin only when
 * AUTH_MODE=mock (foundation preview, no new backend built).
 */
import { ENDPOINTS } from '@/lib/api/endpoints';
import { http } from '@/lib/api/client';
import { AuthResponse, LoginInput } from '@/types/auth';

export const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'mock';

export async function login(input: LoginInput): Promise<AuthResponse> {
  return http.post<AuthResponse>(ENDPOINTS.auth.login, input);
}

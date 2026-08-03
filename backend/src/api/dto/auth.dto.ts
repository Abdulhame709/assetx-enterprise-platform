/**
 * Auth request/response DTOs.
 * Reference: API Spec (DOC-10) auth endpoints
 */

export interface RegisterRequestDto {
  tenantId?: string;
  username: string;
  email?: string;
  password: string;
}

export interface LoginRequestDto {
  username: string;
  password: string;
}

export interface RefreshRequestDto {
  refreshToken: string;
}

export interface ResetPasswordRequestDto {
  username: string;
  newPassword: string;
}

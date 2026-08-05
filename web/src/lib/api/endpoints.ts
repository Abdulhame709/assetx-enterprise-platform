/**
 * Central endpoint registry — maps UI needs to existing backend routes.
 * Keeps endpoint URLs centralized. Aligned with the real backend contract
 * (Phase PRE-P3.1): /auth/me does not exist on the backend, so it was removed;
 * /tenant/current is the real tenant-lookup endpoint.
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  tenant: {
    current: '/tenant/current',
  },
} as const;

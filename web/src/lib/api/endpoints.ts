/**
 * Central endpoint registry — maps UI needs to existing backend routes.
 * Keeping endpoints centralized avoids scattering URL strings across modules.
 * Business endpoints are added incrementally when their screens land (P2+).
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    me: '/auth/me',
    logout: '/auth/logout',
  },
} as const;

/**
 * P1 demo session — simulates authentication so the Application Shell renders
 * without a running backend. The real AuthService is wired for production; this
 * mock is used only for the foundation preview (no new backend built).
 */
import { AuthResponse } from '@/types/auth';
import { PERMISSIONS } from './permissions';

const ALL = Object.values(PERMISSIONS);

export const MOCK_ACCOUNTS: Record<
  string,
  { password: string; displayName: string; roles: string[]; permissions: string[] }
> = {
  admin: {
    password: 'AdminPass123',
    displayName: 'System Administrator',
    roles: ['Administrator'],
    permissions: ['*'],
  },
  manager: {
    password: 'Manager123',
    displayName: 'Asset Manager',
    roles: ['Asset Manager'],
    permissions: ALL,
  },
  inventory: {
    password: 'Inventory123',
    displayName: 'Inventory Officer',
    roles: ['Inventory Team'],
    permissions: ALL.filter((p) => p.startsWith('inventory') || p.startsWith('asset') || p.startsWith('dashboard')),
  },
  auditor: {
    password: 'Auditor123',
    displayName: 'Auditor',
    roles: ['Auditor'],
    permissions: ALL.filter((p) => ['dashboard.view', 'compliance.view', 'audit.view', 'report.view', 'report.export'].includes(p)),
  },
  executive: {
    password: 'Executive123',
    displayName: 'Executive Manager',
    roles: ['Executive'],
    permissions: ALL.filter((p) => p.startsWith('dashboard') || p.startsWith('report') || p.startsWith('analytics')),
  },
};

export function mockLogin(username: string, password: string): AuthResponse {
  const account = MOCK_ACCOUNTS[username.toLowerCase()];
  if (!account || account.password !== password) {
    const err = new Error('Invalid username or password');
    (err as Error & { code?: string }).code = 'INVALID_CREDENTIALS';
    throw err;
  }
  return {
    accessToken: `mock.${username}`,
    refreshToken: undefined,
    user: {
      id: `mock-${username}`,
      username,
      displayName: account.displayName,
      roles: account.roles,
    },
    tenant: { id: 'tenant-a', name: 'Tenant A', code: 'tenant_a' },
    permissions: account.permissions,
  };
}

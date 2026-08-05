import { describe, it, expect } from 'vitest';
import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it('returns false for no permissions', () => {
    expect(hasPermission(undefined, 'asset.view')).toBe(false);
    expect(hasPermission([], 'asset.view')).toBe(false);
  });

  it('matches an exact permission', () => {
    expect(hasPermission(['asset.view'], 'asset.view')).toBe(true);
    expect(hasPermission(['asset.view', 'movement.view'], 'movement.view')).toBe(true);
  });

  it('does not match a different permission', () => {
    expect(hasPermission(['asset.view'], 'asset.delete')).toBe(false);
  });

  it('honors wildcard * and admin.*', () => {
    expect(hasPermission(['*'], 'anything.at.all')).toBe(true);
    expect(hasPermission(['admin.*'], 'asset.delete')).toBe(true);
  });

  it('honors section wildcard', () => {
    expect(hasPermission(['asset.*'], 'asset.create')).toBe(true);
    expect(hasPermission(['asset.*'], 'movement.view')).toBe(false);
  });
});

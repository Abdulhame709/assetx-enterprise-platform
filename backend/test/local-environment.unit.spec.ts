import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadLocalEnvironment } from '../src/bootstrap/local-environment';

describe('loadLocalEnvironment', () => {
  it('loads local values but preserves values provided by the host process', () => {
    const directory = mkdtempSync(join(tmpdir(), 'assetx-env-'));
    const environmentPath = join(directory, '.env');
    const environment: Record<string, string | undefined> = {
      PORT: '3999',
    };

    try {
      writeFileSync(environmentPath, 'PORT=3001\nLOCAL_TEST_VALUE="loaded"\n', 'utf8');

      expect(loadLocalEnvironment(environmentPath, environment)).toBe(true);
      expect(environment.PORT).toBe('3999');
      expect(environment.LOCAL_TEST_VALUE).toBe('loaded');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does nothing when the local environment file is absent', () => {
    const environment: Record<string, string | undefined> = {};
    expect(loadLocalEnvironment('/tmp/assetx-env-file-that-does-not-exist', environment)).toBe(false);
    expect(environment).toEqual({});
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Environment = Record<string, string | undefined>;

/**
 * Loads backend/.env only for a local process and never overwrites variables
 * explicitly supplied by its host environment. This keeps local runtime and
 * local maintenance tools on the same database configuration.
 */
export function loadLocalEnvironment(
  environmentPath = resolve(process.cwd(), '.env'),
  environment: Environment = process.env,
): boolean {
  if (!existsSync(environmentPath)) return false;

  for (const line of readFileSync(environmentPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || environment[match[1]] !== undefined) continue;

    const [, key, rawValue] = match;
    const value =
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")))
        ? rawValue.slice(1, -1)
        : rawValue;
    environment[key] = value;
  }

  return true;
}

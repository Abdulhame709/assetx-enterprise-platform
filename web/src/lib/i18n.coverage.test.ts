/**
 * Guards the Arabic UI:
 *  1. English and Arabic dictionaries have exactly the same keys.
 *  2. Every translation key used in source code exists in the dictionary.
 *  3. Shared components / login page contain no hard-coded English JSX text
 *     or English string props (placeholder, title, aria-label...).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AR_LABELS, LABELS, TRANSLATIONS } from './i18n';
import { humanError } from './api/errors';
import { ApiError } from './api/client';

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC);
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, '/');

describe('i18n dictionaries', () => {
  it('en and ar define the same keys', () => {
    const en = Object.keys(TRANSLATIONS.en);
    const ar = new Set(Object.keys(TRANSLATIONS.ar));
    expect(en.filter((k) => !ar.has(k))).toEqual([]);
    const enSet = new Set(en);
    expect([...ar].filter((k) => !enSet.has(k))).toEqual([]);
  });

  it('has no empty Arabic values', () => {
    const empty = Object.entries(TRANSLATIONS.ar).filter(([, v]) => !v.trim()).map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('defines every key referenced from source', () => {
    const used = /(?:\bt\(\s*|[A-Za-z]*Key:\s*)['"]([A-Za-z][\w]*(?:\.[\w]+)+)['"]/g;
    const missing: string[] = [];
    for (const file of FILES) {
      if (rel(file) === 'lib/i18n.tsx') continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(used)) {
        if (!(m[1] in TRANSLATIONS.en) || !(m[1] in TRANSLATIONS.ar)) missing.push(`${rel(file)}: ${m[1]}`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});

const BACKEND = path.resolve(SRC, '../../backend/src');
const backendFile = (rel: string) => path.join(BACKEND, rel);
const hasBackend = (() => { try { statSync(BACKEND); return true; } catch { return false; } })();

describe.skipIf(!hasBackend)('backend catalogs are translated', () => {
  it('every audit event has an English and an Arabic label', () => {
    const text = readFileSync(backendFile('core/constants/audit-events.ts'), 'utf8');
    const events = [...text.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*'/gm)].map((m) => m[1]);
    expect(events.length).toBeGreaterThan(30);
    expect(events.filter((e) => !(e in LABELS))).toEqual([]);
    expect(events.filter((e) => !(e in AR_LABELS))).toEqual([]);
  });

  it('every compliance / integrity check has a translation', () => {
    const files = ['application/compliance.service.ts', 'application/integrity-checker.service.ts'];
    const checks = files.flatMap((f) => [...readFileSync(backendFile(f), 'utf8').matchAll(/(?:warn|build)\('([a-z_]+)'/g)].map((m) => m[1]));
    expect(checks.length).toBeGreaterThan(10);
    expect(checks.filter((c) => !(`compliance.check.${c}` in TRANSLATIONS.ar))).toEqual([]);
  });

  it('every API error code has an Arabic and an English message', () => {
    const text = readFileSync(backendFile('common/http/error-codes.ts'), 'utf8');
    const codes = [...text.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*\{/gm)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(50);
    const generic = new Set(['PAYLOAD_TOO_LARGE']);
    const unknown = (c: string, lang: 'ar' | 'en') => {
      const err = new ApiError(400, c, 'VALIDATION_ERROR');
      return humanError(err, 'FALLBACK', lang) === 'FALLBACK';
    };
    expect(codes.filter((c) => !generic.has(c) && unknown(c, 'ar'))).toEqual([]);
    expect(codes.filter((c) => !generic.has(c) && unknown(c, 'en'))).toEqual([]);
  });
});

/** Files that must be fully translated; extended as screens are converted. */
const STRICT = [
  'app/(auth)',
  'components/ui/Modal.tsx',
  'components/ui/ActionMenu.tsx',
  'components/ui/AsyncBoundary.tsx',
  'components/ui/Breadcrumbs.tsx',
  'components/ui/SkipLink.tsx',
  'components/ui/CommandToolbar.tsx',
  'components/shell',
];

const ENGLISH_PROP = /\b(?:placeholder|title|aria-label|alt|label|description)=["']([^"'{}]*[A-Za-z]{3,}[^"'{}]*)["']/g;
// Text between tags: >Some English words< (ignores {expressions}).
const ENGLISH_TEXT = />\s*([A-Z][A-Za-z][A-Za-z ,.'!?-]{2,})\s*</g;

describe('hard-coded English in strict files', () => {
  const strictFiles = FILES.filter((f) => f.endsWith('.tsx') && STRICT.some((p) => rel(f).startsWith(p)));

  it('covers at least one file', () => {
    expect(strictFiles.length).toBeGreaterThan(0);
  });

  it('has no English JSX text or props', () => {
    const offenders: string[] = [];
    for (const file of strictFiles) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(ENGLISH_PROP)) offenders.push(`${rel(file)}: prop "${m[1]}"`);
      for (const m of text.matchAll(ENGLISH_TEXT)) {
        // skip generics / type arguments such as <Foo>Bar</Foo> in non-JSX contexts
        if (/^(?:Promise|Array|Record|Partial|Omit|Pick)$/.test(m[1])) continue;
        offenders.push(`${rel(file)}: text "${m[1]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

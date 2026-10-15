/**
 * Content-Disposition for report downloads. The file is named after the report
 * ("تقرير الأصول 2026-10-15.pdf") through the RFC 5987 `filename*` parameter, while
 * the plain `filename` stays ASCII for clients that do not understand it.
 */

const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/** Report title -> a safe file name (no extension). Empty when nothing usable is left. */
export function displayFileName(title: string | undefined, date: Date = new Date()): string {
  const clean = (title ?? '').replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim();
  if (!clean) return '';
  return `${clean} ${date.toISOString().slice(0, 10)}`;
}

export function contentDisposition(asciiFilename: string, title?: string, date: Date = new Date()): string {
  const base = displayFileName(title, date);
  const ascii = asciiFilename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  if (!base) return `attachment; filename="${ascii}"`;
  const dot = asciiFilename.lastIndexOf('.');
  const ext = dot >= 0 ? asciiFilename.slice(dot) : '';
  const encoded = encodeURIComponent(`${base}${ext}`).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

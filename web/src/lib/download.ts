/** File name from a Content-Disposition header: the UTF-8 `filename*` (Arabic report names) wins over the ASCII fallback. */
export function filenameFromDisposition(disposition: string, fallback: string): string {
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* malformed encoding: use the plain name */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

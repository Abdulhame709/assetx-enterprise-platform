/** Minimal className joiner (space-aware, filters falsy). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

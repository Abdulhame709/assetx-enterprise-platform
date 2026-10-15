import { cn } from '@/lib/cn';

const SIZES = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-base' };

// Warm, readable background pairs drawn from the design palette (all pass AA with white text).
const TONES = ['bg-brand', 'bg-accent-dark text-surface', 'bg-success', 'bg-info', 'bg-warning', 'bg-danger'];

/** Up to two initials: first letters of the first two words (works for Arabic and Latin). */
export function initialsOf(name: string | undefined | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words.slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('en');
}

function toneFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return TONES[hash % TONES.length];
}

/** Avatar — image or deterministic initials chip. Decorative unless `title` is given. */
export function Avatar({ name, src, size = 'md', className }: { name?: string | null; src?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const base = cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface', SIZES[size], className);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cn(base, 'object-cover')} />;
  }
  return (
    <span className={cn(base, toneFor(name ?? ''))} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

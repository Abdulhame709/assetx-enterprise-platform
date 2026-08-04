import type { Config } from 'tailwindcss';

/**
 * AssetX Design System → Tailwind theme mapping.
 * Tokens (colors, fonts, spacing) live in globals.css as CSS custom properties;
 * Tailwind resolves them via rgb()/var() so dark mode & theming stay token-driven.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--ax-primary) / <alpha-value>)',
          soft: 'rgb(var(--ax-primary-soft) / <alpha-value>)',
          fg: 'rgb(var(--ax-primary-fg) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--ax-surface) / <alpha-value>)',
          raised: 'rgb(var(--ax-surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--ax-surface-overlay) / <alpha-value>)',
          muted: 'rgb(var(--ax-surface-muted) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ax-ink) / <alpha-value>)',
          muted: 'rgb(var(--ax-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ax-ink-faint) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--ax-line) / <alpha-value>)',
        },
        success: 'rgb(var(--ax-success) / <alpha-value>)',
        warning: 'rgb(var(--ax-warning) / <alpha-value>)',
        danger: 'rgb(var(--ax-danger) / <alpha-value>)',
        info: 'rgb(var(--ax-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--ax-font-sans)'],
        display: ['var(--ax-font-display)'],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
      },
      borderRadius: {
        DEFAULT: 'var(--ax-radius)',
        lg: 'var(--ax-radius-lg)',
        xl: 'var(--ax-radius-xl)',
      },
      boxShadow: {
        card: 'var(--ax-shadow-card)',
        pop: 'var(--ax-shadow-pop)',
      },
    },
  },
  plugins: [],
};

export default config;

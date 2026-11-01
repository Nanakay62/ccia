/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'Georgia',
          'Cambria',
          '"Palatino Linotype"',
          '"Times New Roman"',
          'serif',
        ],
        sans: [
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius)',
        lg: 'var(--radius)',
      },
      colors: {
        surface: {
          ground: 'var(--surface-ground)',
          panel: 'var(--surface-panel)',
          subtle: 'var(--surface-subtle)',
          border: 'var(--surface-border)',
          'border-subtle': 'var(--surface-border-subtle)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
          foreground: 'var(--accent-foreground)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          subtle: 'var(--gold-subtle)',
        },
        status: {
          green: 'var(--status-green)',
          'green-bg': 'var(--status-green-bg)',
          amber: 'var(--status-amber)',
          'amber-bg': 'var(--status-amber-bg)',
          red: 'var(--status-red)',
          'red-bg': 'var(--status-red-bg)',
          grey: 'var(--status-grey)',
          'grey-bg': 'var(--status-grey-bg)',
        },
      },
    },
  },
  plugins: [],
};

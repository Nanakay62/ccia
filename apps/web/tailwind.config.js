/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Roboto',
          'Segoe UI Variable',
          'Segoe UI',
          'Aptos',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"Roboto Mono"',
          '"Cascadia Code"',
          'Consolas',
          'ui-monospace',
          'monospace',
        ],
        numeric: [
          '"Roboto Mono"',
          '"Cascadia Code"',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};

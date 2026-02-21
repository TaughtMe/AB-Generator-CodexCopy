import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        worksheet: {
          paper: '#ffffff',
          field: '#f8fafc',
          border: '#e2e8f0',
          ink: '#0f172a',
          inkLight: '#475569',
        },
      },
    },
  },
} satisfies Config;

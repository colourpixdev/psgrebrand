import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
        },
        signal: {
          green: '#18a957',
          blue: '#2563eb',
          amber: '#f59e0b',
          orange: '#f97316',
          red: '#ef4444',
          grey: '#64748b',
        },
      },
      boxShadow: {
        soft: '0 24px 80px rgba(2, 6, 23, 0.14)',
      },
      backgroundImage: {
        'grid-fade': 'radial-gradient(circle at top, rgba(37, 99, 235, 0.16), transparent 38%), linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9))',
      },
    },
  },
  plugins: [],
} satisfies Config;

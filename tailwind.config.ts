import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B2E6B',
          dark: '#152358',
          light: '#2D4A9E',
        },
        status: {
          open: '#22c55e',
          closed: '#ef4444',
          inprogress: '#a855f7',
          backlogged: '#eab308',
          awaitingcost: '#6b7280',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

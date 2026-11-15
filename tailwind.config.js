import { fileURLToPath } from 'node:url'

// Пути от папки site/, откуда бы ни запускали vite (glob требует прямые слэши)
const here = (p) => fileURLToPath(new URL(p, import.meta.url)).split('\\').join('/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [here('./index.html'), here('./src') + '/**/*.{vue,js}'],
  darkMode: 'class', // тёмной темы нет — сайт всегда светлый
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', '"Segoe UI"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        page: '#f5f6fa',
        ink: '#1f2433',
        soft: '#6b7185',
        accent: { DEFAULT: '#4f63d8', soft: '#eef0fd' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(31,36,51,.04), 0 4px 14px rgba(31,36,51,.06)',
        lift: '0 2px 4px rgba(31,36,51,.05), 0 12px 28px rgba(79,99,216,.16)',
      },
    },
  },
}

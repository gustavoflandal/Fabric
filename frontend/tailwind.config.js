/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cores da logo Fabric
        fabric: {
          // Azul escuro (base)
          slate: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#4a6b7c',
            700: '#3B5266',
            800: '#2d3e4f',
            900: '#1e2a38',
          },
          // Cyan/Turquesa (destaque)
          cyan: {
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#5DADE2',
            500: '#48C9B0',
            600: '#3ba89f',
            700: '#2e8b82',
            800: '#236e66',
            900: '#1a524c',
          },
          // Laranja (acento)
          orange: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#F39C12',
            500: '#E67E22',
            600: '#d97706',
            700: '#b45309',
            800: '#92400e',
            900: '#78350f',
          },
          // Cinza (neutro)
          gray: {
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#BDC3C7',
            500: '#95A5A6',
            600: '#6b7280',
            700: '#4b5563',
            800: '#374151',
            900: '#1f2937',
          },
        },
        // Aliases para facilitar uso
        primary: {
          DEFAULT: '#4a6b7c',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#4a6b7c',
          700: '#3B5266',
          800: '#2d3e4f',
          900: '#1e2a38',
        },
        secondary: {
          DEFAULT: '#48C9B0',
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#5DADE2',
          500: '#48C9B0',
          600: '#3ba89f',
          700: '#2e8b82',
          800: '#236e66',
          900: '#1a524c',
        },
        accent: {
          DEFAULT: '#F39C12',
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#F39C12',
          500: '#E67E22',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
    },
  },
  plugins: [],
}

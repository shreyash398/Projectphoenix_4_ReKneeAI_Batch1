/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: '#FAF8F5',
          subtle: '#F4EFEA',
          border: '#E8E2D9',
        },
        navy: {
          950: '#0A1120',
          900: '#0F1D38',
          800: '#1A2E56',
          700: '#254077',
        },
        slate: {
          muted: '#5A667A',
          subtle: '#8C98A9',
        },
        teal: {
          calm: '#0D9488',
          hover: '#0F766E',
          light: '#F0FDFA',
          border: '#99F6E4',
        },
        status: {
          success: '#15803D',
          'success-bg': '#F0FDF4',
          warning: '#D97706',
          'warning-bg': '#FFFBEB',
          error: '#DC2626',
          'error-bg': '#FEF2F2',
          engagement: '#2563EB',
          'engagement-bg': '#EFF6FF',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(15, 29, 56, 0.05), 0 1px 4px -1px rgba(15, 29, 56, 0.03)',
        card: '0 4px 14px -3px rgba(15, 29, 56, 0.07), 0 2px 6px -2px rgba(15, 29, 56, 0.04)',
      }
    },
  },
  plugins: [],
}

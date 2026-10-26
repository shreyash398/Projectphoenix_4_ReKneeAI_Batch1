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
          bg: '#F8FAFC',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
        },
        navy: {
          950: '#060D1A',
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        slate: {
          muted: '#64748B',
          subtle: '#94A3B8',
        },
        teal: {
          calm: '#0D9488',
          hover: '#0F766E',
          light: '#F0FDFA',
          border: '#99F6E4',
          accent: '#14B8A6',
          surface: '#E6FFFA',
        },
        status: {
          success: '#059669',
          'success-bg': '#ECFDF5',
          warning: '#D97706',
          'warning-bg': '#FFFBEB',
          error: '#DC2626',
          'error-bg': '#FEF2F2',
          engagement: '#2563EB',
          'engagement-bg': '#EFF6FF',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        card: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        float: '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch Clinical Kineticism Tokens
        primary: {
          DEFAULT: '#006c4b',
          container: '#16a878',
          fixed: '#7df9c3',
          'fixed-dim': '#5edda8',
        },
        'on-primary': '#ffffff',
        'on-primary-container': '#003422',
        'on-primary-fixed': '#002114',
        'on-primary-fixed-variant': '#005138',
        'inverse-primary': '#5edda8',

        secondary: {
          DEFAULT: '#712ae2',
          container: '#8a4cfc',
          fixed: '#eaddff',
          'fixed-dim': '#d2bbff',
        },
        'on-secondary': '#ffffff',
        'on-secondary-container': '#fffbff',
        'on-secondary-fixed': '#25005a',
        'on-secondary-fixed-variant': '#5a00c6',

        tertiary: {
          DEFAULT: '#006686',
          container: '#409ec5',
          fixed: '#c0e8ff',
          'fixed-dim': '#79d1fb',
        },
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#003142',
        'on-tertiary-fixed': '#001e2b',
        'on-tertiary-fixed-variant': '#004d66',

        surface: {
          DEFAULT: '#fcf9f8',
          dim: '#dcd9d9',
          bright: '#fcf9f8',
          tint: '#006c4b',
          variant: '#e5e2e1',
          container: {
            lowest: '#ffffff',
            low: '#f6f3f2',
            DEFAULT: '#f0eded',
            high: '#eae7e7',
            highest: '#e5e2e1',
          },
        },
        'on-surface': '#1c1b1b',
        'on-surface-variant': '#3d4a42',
        'inverse-surface': '#313030',
        'inverse-on-surface': '#f3f0ef',

        outline: {
          DEFAULT: '#6d7a72',
          variant: '#bccac0',
        },

        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': '#ffffff',
        'on-error-container': '#93000a',

        // Legacy compatibility aliases
        warm: {
          bg: '#fcf9f8',
          subtle: '#f6f3f2',
          border: '#e5e2e1',
        },
        navy: {
          950: '#111111',
          900: '#1c1b1b',
          800: '#313030',
          700: '#3d4a42',
        },
        slate: {
          muted: '#6d7a72',
          subtle: '#bccac0',
        },
        teal: {
          calm: '#16a878',
          hover: '#006c4b',
          light: '#e8f7f2',
          border: '#7df9c3',
          accent: '#5edda8',
          surface: '#f6f3f2',
        },
        status: {
          success: '#16a878',
          'success-bg': '#e8f7f2',
          warning: '#d97706',
          'warning-bg': '#fffbeb',
          error: '#ba1a1a',
          'error-bg': '#ffdad6',
          engagement: '#712ae2',
          'engagement-bg': '#eaddff',
        }
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
      letterSpacing: {
        tighter: '-0.035em',
        tight: '-0.02em',
        normal: '0em',
        wide: '0.02em',
        wider: '0.04em',
        widest: '0.08em',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2rem',
        'full': '9999px',
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(17, 24, 39, 0.04), 0 1px 3px 0 rgba(17, 24, 39, 0.02)',
        card: '0 4px 24px -4px rgba(17, 24, 39, 0.06), 0 1px 4px 0 rgba(17, 24, 39, 0.02)',
        float: '0 16px 40px -6px rgba(17, 24, 39, 0.12), 0 4px 12px -2px rgba(17, 24, 39, 0.06)',
      }
    },
  },
  plugins: [],
}

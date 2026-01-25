/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,njk,md,js}",
    "./.eleventy.js",
  ],
  darkMode: 'class',
  safelist: ['dark', 'sr-only', 'skip-to-main'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--clr-primary-50)',
          100: 'var(--clr-primary-100)',
          200: 'var(--clr-primary-200)',
          300: 'var(--clr-primary-300)',
          400: 'var(--clr-primary-400)',
          500: 'var(--clr-primary-500)',
          600: 'var(--clr-primary-600)',
          700: 'var(--clr-primary-700)',
          800: 'var(--clr-primary-800)',
          900: 'var(--clr-primary-900)',
          950: 'var(--clr-primary-950)',
        },
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: 'var(--fg)',
            a: {
              color: 'oklch(62.31% 0.188 259.81)',
              textDecoration: 'underline',
              textDecorationColor: 'transparent',
              textUnderlineOffset: '2px',
              transition: 'all 150ms ease',
              '&:hover': {
                color: 'oklch(72% 0.2 259.81)',
                textDecorationColor: 'currentColor',
              },
              code: {
                color: 'var(--clr-primary-400)',
              },
            },
            'h1,h2': {
              fontWeight: '700',
              letterSpacing: 'var(--tracking-tight)',
            },
            h3: {
              fontWeight: '600',
            },
            'h4,h5,h6': {
              fontWeight: '600',
            },
            code: {
              color: 'var(--color-indigo-500)',
            },
          },
        },
        invert: {
          css: {
            a: {
              color: 'oklch(62.31% 0.188 259.81)',
              '&:hover': {
                color: 'oklch(72% 0.2 259.81)',
              },
              code: {
                color: 'var(--clr-primary-400)',
              },
            },
            'h1,h2,h3,h4,h5,h6': {
              color: 'var(--color-gray-100)',
            },
          },
        },
      }),
      fontFamily: {
        display: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        subheading: ['"Plus Jakarta Sans"', '"DM Sans"', '-apple-system', 'sans-serif'],
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'Monaco', 'monospace'],
        feature: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
        '5xl': 'var(--font-size-5xl)',
      },
      spacing: {
        touch: '44px',
        'touch-sm': '36px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

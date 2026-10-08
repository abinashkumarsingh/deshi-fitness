/** Design tokens live in src/index.css as CSS variables (dark default, light override). */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), elevated: v('elevated'), line: v('line'),
        fg: v('fg'), muted: v('muted'), accent: v('accent'), 'on-accent': v('on-accent'),
        success: v('success'), warning: v('warning'), danger: v('danger'), info: v('info'),
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'system-ui', 'sans-serif'],
        display: ['"Unbounded Variable"', '"Geist Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: { hero: ['112px', { lineHeight: '1', letterSpacing: '-0.04em' }], big: ['64px', { lineHeight: '1', letterSpacing: '-0.03em' }] },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '20px' },
    },
  },
  plugins: [],
};

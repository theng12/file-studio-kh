/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#202124',
        mist: '#f5f6f7',
        line: '#d8dde3',
        accent: '#256f7a',
        // Neutral ramp (studio-design-tokens): page / surface / border / muted / body
        page: '#f5f6f7',
        surface: '#ffffff',
        border: '#d8dde3',
        muted: '#6b7280',
        body: '#202124',
      },
      // Shared KH layout numbers (studio-design-tokens.json)
      spacing: { xs: '4px', tight: '6px', s: '8px', m: '12px', l: '16px', xl: '24px', page: '28px' },
      borderRadius: { control: '6px', card: '8px', sheet: '12px' },
      width: { sidebar: '220px' },
      fontSize: {
        caption: ['11px', { lineHeight: '15px' }],
        secondary: ['12px', { lineHeight: '16px' }],
        body: ['13px', { lineHeight: '19px' }],
        figure: ['22px', { lineHeight: '28px', fontWeight: '600' }],
        pageTitle: ['26px', { lineHeight: '32px', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};

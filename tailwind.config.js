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
      },
    },
  },
  plugins: [],
};

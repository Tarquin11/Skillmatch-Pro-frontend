/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef8ff',
          100: '#d9efff',
          200: '#bce3ff',
          300: '#8fd3ff',
          400: '#5ab9ff',
          500: '#3398ff',
          600: '#1f79f5',
          700: '#195fe1',
          800: '#1b4eb6',
          900: '#1b438f',
        },
      },
    },
  },
  plugins: [],
};


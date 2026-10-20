/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shaha: {
          plum: '#35172d',
          orange: '#e96f0b',
          'orange-dark': '#ce5d05',
          canvas: '#f7f4f6',
          ink: '#32182b',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

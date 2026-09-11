/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        outbox: {
          green: '#00A854',
          hoverGreen: '#009249',
          lightGreen: '#E8F5E9',
          borderGreen: '#86EFAC',
          darkGreen: '#007A3D',
          amber: '#EA580C',
          amberBg: '#FFF7ED',
          amberBorder: '#FED7AA',
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#00a854',
          600: '#009249',
          700: '#007a3d',
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0066CC',
          dark: '#004C99',
          light: '#E3F0FF',
        },
        cfr: {
          red: '#E53935',
          blue: '#1E88E5',
          green: '#43A047',
          purple: '#8E24AA',
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        canela: ['"Canela Deck"', 'Georgia', 'serif'],
        neue: ['"PP Neue Montreal"', 'sans-serif'],
      }
    },
  },
  plugins: [],
};

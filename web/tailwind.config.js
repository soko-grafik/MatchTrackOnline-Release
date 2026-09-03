/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Ohne diesen Pfad werden Klassen, die es nur in den Contexts gibt, nie generiert
    // (z. B. das z-[99999] des Confirm-Dialogs, der dadurch hinter Modals lag).
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./services/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // Falls du einen src-Ordner nutzt
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#ffffff",
        primary: {
          50: '#eefcf4',
          100: '#d7f7e4',
          200: '#b2ecce',
          300: '#7edbb1',
          400: '#46c28f',
          500: '#23a473',
          600: '#15835b',
          700: '#11694a',
          800: '#11533c',
          900: '#104432',
          950: '#08261d',
          DEFAULT: '#23a473', // MatchTrack Green
          hover: '#15835b',
        },
        accent: {
          DEFAULT: '#2563eb', // A blue accent if needed
          hover: '#1d4ed8',
        }
      },
      borderRadius: {
        'none': '0px',
        'sm': '0.125rem',
        'DEFAULT': '0.25rem',
        'md': '0.25rem',
        'lg': '0.25rem',
        'xl': '0.25rem',
        '2xl': '0.25rem',
        '3xl': '0.25rem',
        'full': '0.25rem',
      },
    },
  },
  plugins: [],
}

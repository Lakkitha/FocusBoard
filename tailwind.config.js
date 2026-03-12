/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme palette
        surface: {
          50:  '#f8f8f8',
          100: '#e8e8e8',
          900: '#0f0f13',
          800: '#16161d',
          700: '#1e1e28',
          600: '#25252f',
          500: '#2e2e3a',
          400: '#3a3a48',
        },
        brand: {
          purple: '#7c6af7',
          blue:   '#4fa5ff',
          teal:   '#2dd4bf',
          green:  '#4ade80',
          amber:  '#fbbf24',
          pink:   '#f472b6',
          red:    '#f87171',
        },
        // Category colors
        category: {
          courses:  '#7c6af7',
          passive:  '#2dd4bf',
          work:     '#4fa5ff',
          health:   '#4ade80',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1rem',
        xl3: '1.25rem',
      },
    },
  },
  plugins: [],
}

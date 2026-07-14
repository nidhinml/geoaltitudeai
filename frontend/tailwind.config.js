/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // supports dark mode
  theme: {
    extend: {
      colors: {
        // Custom color palette for GeoAltitude (Topographic/Earth themes mixed with sleek cyber darks)
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e', // Emerald primary
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        darkbg: {
          DEFAULT: '#0B0F19',
          card: '#161D30',
          border: '#1F293D',
          hover: '#263554',
          text: '#F3F4F6',
          muted: '#9CA3AF'
        },
        altitude: {
          low: '#3b82f6',     // Blue for low lands
          mid: '#10b981',     // Emerald for valley/hills
          high: '#f59e0b',    // Amber for high mountains
          extreme: '#ef4444', // Red for extreme peaks
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(17, 24, 39, 0.7), rgba(17, 24, 39, 0.3))',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
        'neon': '0 0 15px rgba(34, 197, 94, 0.5)',
      },
      backdropBlur: {
        'glass': '12px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}

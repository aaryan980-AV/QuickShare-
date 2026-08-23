/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkNavy: '#0b0f1a',
        sendBg: '#16234a',
        sendIcon: '#5b8def',
        sendText: '#8ea4d1',
        sendBorder: '#2c4485',
        receiveBg: '#16302a',
        receiveIcon: '#4ade80',
        receiveText: '#8fc9a8',
        receiveBorder: '#2e5c4a',
        mutedGray: '#8b93a7',
        statusGray: '#9aa3b8',
        trackBg: '#1c2333',
        progressFill: '#3b82f6',
        qrBg: '#141a29',
        qrBorder: '#262f45',
        buttonBg: '#1c2333',
        buttonBorder: '#2e3650',
      },
      screens: {
        'xs': '480px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}

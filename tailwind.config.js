/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#1E293B', // Tailwind slate-800
        panel: '#0F172A',      // Tailwind slate-900
        panelBorder: '#334155',// Tailwind slate-700
        primaryAccent: '#3B82F6', // Tailwind blue-500
        dangerAlert: '#EF4444',   // Tailwind red-500
        warning: '#F59E0B',
        success: '#10B981',
        purpleTrend: '#A855F7',
        orangeTrend: '#F97316'
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}


/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,tsx}",
  ],
  safelist: [
    // Active
    'from-emerald-500','via-green-500','to-lime-500',
    'ring-emerald-200/40','ring-emerald-200','text-emerald-600',
    // Idle
    'from-amber-500','via-orange-500','to-yellow-500',
    'ring-amber-200/40','ring-amber-200','text-amber-600',
    // Maintenance
    'from-slate-400','via-gray-400','to-zinc-500',
    'ring-gray-300/50','ring-gray-300','text-slate-700',
    // Overall (if not elsewhere)
    'from-blue-500','via-indigo-500','to-purple-500',
    'ring-indigo-200/40','ring-indigo-200','text-indigo-600',
    // Needed base
    'bg-gradient-to-r',
    'bg-gradient-to-br',
    'from-green-600','to-green-500',
    'from-red-700','to-red-800',
    'from-gray-700','to-gray-800',
    'from-gray-400','to-gray-500',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
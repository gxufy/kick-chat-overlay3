/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* Generator-workspace surface tokens. Used only by components under
         components/workspace and components/ui — no overlay rendering CSS
         reads these, and no existing stylesheet was changed to adopt them. */
      colors: {
        'ws-bg': '#101012',
        'ws-surface': '#17171a',
        'ws-border': '#2a2a30',
        'ws-control': '#22222a',
        'ws-control-hover': '#2c2c36',
        'ws-text': '#ededf0',
        'ws-muted': '#9a9aa5',
        'ws-accent': '#6d4aff',
        'ws-accent-hover': '#7f60ff',
        'ws-ring': '#8b6cff',
        'ws-danger': '#f87171',
      },
      keyframes: {
        slide: { '0%': { transform: 'translateX(-100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        fade: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        slide: 'slide 0.2s ease-in-out',
        fade: 'fade 0.2s ease-in-out',
      },
      textShadow: {
        sm: '0 1px 2px #000, 0 0 1px #000, 0 0 1px #000, 0 0 1px #000, 0 0 1px #000',
        md: '0 1px 3px #000, 0 0 1.5px #000, 0 0 1.5px #000, 0 0 1.5px #000, 0 0 1.5px #000',
        lg: '0 1px 4px #000, 0 0 2px #000, 0 0 2px #000, 0 0 2px #000, 0 0 2px #000',
      },
    },
  },
  plugins: [
    function ({ matchUtilities, addVariant, theme }) {
      // Apply text-shadow only in dark mode, like the original dark:text-shadow-* classes
      addVariant('dark-shadow', ':is(.dark &)');
      matchUtilities(
        { 'text-shadow': (value) => ({ textShadow: value }) },
        { values: theme('textShadow') }
      );
    },
  ],
};

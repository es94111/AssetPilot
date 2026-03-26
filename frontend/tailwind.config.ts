import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },
        cta: {
          DEFAULT: '#F97316',
          light: '#FB923C',
          dark: '#EA580C',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
          hover: '#F1F5F9',
        },
        text: {
          DEFAULT: '#1E293B',
          muted: '#64748B',
          light: '#94A3B8',
        },
      },
      fontFamily: {
        heading: ['Lora', 'serif'],
        body: ['Raleway', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

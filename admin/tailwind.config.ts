// admin/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  // CRITICAL: these paths tell Tailwind which files to scan for class names.
  // If these are wrong, Tailwind generates an empty CSS file → no styles.
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEEDFE',
          100: '#CECBF6',
          200: '#AFA9EC',
          400: '#7F77DD',
          600: '#534AB7',
          800: '#3C3489',
          900: '#26215C',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:      '12px',
        xl:      '16px',
      },
    },
  },
  plugins: [],
};

export default config;
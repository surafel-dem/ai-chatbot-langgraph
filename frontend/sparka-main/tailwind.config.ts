import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './artifacts/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist)'],
        mono: ['var(--font-geist-mono)'],
      },
      screens: {
        'toast-mobile': '600px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        typing: {
          '0%, 100%': {
            transform: 'translateY(0)',
            opacity: '0.5',
          },
          '50%': {
            transform: 'translateY(-2px)',
            opacity: '1',
          },
        },
        'loading-dots': {
          '0%, 100%': {
            opacity: '0',
          },
          '50%': {
            opacity: '1',
          },
        },
        wave: {
          '0%, 100%': {
            transform: 'scaleY(1)',
          },
          '50%': {
            transform: 'scaleY(0.6)',
          },
        },
        blink: {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0',
          },
        },
        'text-blink': {
          '0%, 100%': {
            color: 'hsl(var(--primary))',
          },
          '50%': {
            color: 'hsl(var(--muted-foreground))',
          },
        },
        'bounce-dots': {
          '0%, 100%': {
            transform: 'scale(0.8)',
            opacity: '0.5',
          },
          '50%': {
            transform: 'scale(1.2)',
            opacity: '1',
          },
        },
        'thin-pulse': {
          '0%, 100%': {
            transform: 'scale(0.95)',
            opacity: '0.8',
          },
          '50%': {
            transform: 'scale(1.05)',
            opacity: '0.4',
          },
        },
        'pulse-dot': {
          '0%, 100%': {
            transform: 'scale(1)',
            opacity: '0.8',
          },
          '50%': {
            transform: 'scale(1.5)',
            opacity: '1',
          },
        },
        'shimmer-text': {
          '0%': {
            'background-position': '150% center',
          },
          '100%': {
            'background-position': '-150% center',
          },
        },
        'wave-bars': {
          '0%, 100%': {
            transform: 'scaleY(1)',
            opacity: '0.5',
          },
          '50%': {
            transform: 'scaleY(0.6)',
            opacity: '1',
          },
        },
        shimmer: {
          '0%': {
            'background-position': '200% 50%',
          },
          '100%': {
            'background-position': '-200% 50%',
          },
        },
        'spinner-fade': {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        typing: 'typing 1.5s ease-in-out infinite',
        'loading-dots': 'loading-dots 1.4s ease-in-out infinite',
        wave: 'wave 1s ease-in-out infinite',
        blink: 'blink 1s ease-in-out infinite',
        'text-blink': 'text-blink 1s ease-in-out infinite',
        'bounce-dots': 'bounce-dots 1.4s ease-in-out infinite',
        'thin-pulse': 'thin-pulse 2s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
        'shimmer-text': 'shimmer-text 2s linear infinite',
        'wave-bars': 'wave-bars 1s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'spinner-fade': 'spinner-fade 0.8s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
};
export default config;

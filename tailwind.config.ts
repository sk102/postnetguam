import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			// PostNet official fonts
  			roboto: ['Roboto', 'sans-serif'],
  			'roboto-slab': ['Roboto Slab', 'serif'],
  			mono: [
  				'var(--font-mono)',
  				'monospace'
  			]
  		},
  		// Glassmorphism utilities
  		backdropBlur: {
  			xs: '2px',
  		},
  		boxShadow: {
  			'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  			'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.1)',
  			'glass-lg': '0 12px 48px 0 rgba(31, 38, 135, 0.2)',
  			'glass-inset': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)',
  		},
  		colors: {
  			// Glass colors
  			glass: {
  				white: 'rgba(255, 255, 255, 0.25)',
  				'white-strong': 'rgba(255, 255, 255, 0.4)',
  				border: 'rgba(255, 255, 255, 0.18)',
  				dark: 'rgba(17, 25, 40, 0.75)',
  			},
  			postnet: {
  				// Official PostNet brand colors from postnet.com
  				red: '#D11532',
  				'red-dark': '#B0122A',
  				'red-light': '#E8143A',
  				charcoal: '#2D2D2D',
  				'charcoal-light': '#404040',
  				gray: '#666666',
  				'gray-light': '#F5F5F5'
  			},
  			status: {
  				active: '#22c55e',
  				renewal: '#8b5cf6',
  				'due-soon': '#eab308',
  				due: '#f97316',
  				overdue: '#ef4444',
  				hold: '#f59e0b',
  				closed: '#6b7280',
  				available: '#3b82f6'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};

export default config;

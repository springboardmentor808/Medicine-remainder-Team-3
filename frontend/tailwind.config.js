/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ── Vitality Core Design System Tokens (from Google Stitch) ──────────
      colors: {
        // Primary — Teal 600 (Trust, Medical, Calm)
        primary:            '#00685f',
        'on-primary':       '#ffffff',
        'primary-container':'#008378',
        'on-primary-container': '#f4fffc',
        'primary-fixed':    '#89f5e7',
        'primary-fixed-dim':'#6bd8cb',
        'on-primary-fixed': '#00201d',
        'on-primary-fixed-variant': '#005049',
        'inverse-primary':  '#6bd8cb',

        // Secondary — Amber (Warnings, Low-Stock, Alerts)
        secondary:          '#855300',
        'on-secondary':     '#ffffff',
        'secondary-container': '#fea619',
        'on-secondary-container': '#684000',
        'secondary-fixed':  '#ffddb8',
        'secondary-fixed-dim': '#ffb95f',
        'on-secondary-fixed': '#2a1700',
        'on-secondary-fixed-variant': '#653e00',

        // Tertiary — Emerald (Success, Taken Doses, Positive States)
        tertiary:           '#006947',
        'on-tertiary':      '#ffffff',
        'tertiary-container': '#00855b',
        'on-tertiary-container': '#f5fff6',
        'tertiary-fixed':   '#6ffbbe',
        'tertiary-fixed-dim': '#4edea3',
        'on-tertiary-fixed': '#002113',
        'on-tertiary-fixed-variant': '#005236',

        // Error — Red (Emergency ONLY, Critical Missed Doses)
        error:              '#ba1a1a',
        'on-error':         '#ffffff',
        'error-container':  '#ffdad6',
        'on-error-container': '#93000a',

        // Surface & Background Hierarchy
        background:         '#f9f9ff',
        'on-background':    '#111c2d',
        surface:            '#f9f9ff',
        'surface-dim':      '#cfdaf2',
        'surface-bright':   '#f9f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low':    '#f0f3ff',
        'surface-container':        '#e7eeff',
        'surface-container-high':   '#dee8ff',
        'surface-container-highest':'#d8e3fb',
        'surface-tint':     '#006a61',
        'surface-variant':  '#d8e3fb',
        'on-surface':       '#111c2d',
        'on-surface-variant': '#3d4947',
        'inverse-surface':  '#263143',
        'inverse-on-surface': '#ecf1ff',

        // Outline & Borders
        outline:            '#6d7a77',
        'outline-variant':  '#bcc9c6',

        // Semantic Aliases (for dev convenience)
        success:            '#10b981',
        danger:             '#ef4444',
        warning:            '#f59e0b',
        'bg-slate':         '#f9f9ff',
        'text-primary':     '#111c2d',
        'text-secondary':   '#3d4947',
        'border-slate':     '#bcc9c6',
      },

      // ── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans:   ['Inter', 'system-ui', 'sans-serif'],
        inter:  ['Inter', 'system-ui', 'sans-serif'],
        public: ['"Public Sans"', 'system-ui', 'sans-serif'],
        atkinson: ['"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg':  ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['30px', { lineHeight: '38px', fontWeight: '600' }],
        'headline-sm': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg':     ['20px', { lineHeight: '32px', fontWeight: '400' }],
        'body-md':     ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-sm':     ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'caption':     ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-caps':  ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },

      // ── Border Radius ─────────────────────────────────────────────────
      borderRadius: {
        sm:      '4px',
        DEFAULT: '8px',
        md:      '12px',   // Buttons
        lg:      '16px',   // Cards
        xl:      '24px',   // Bottom sheets
        full:    '9999px', // Pills/Tags/FAB
      },

      // ── Spacing (4px base grid) ────────────────────────────────────────
      spacing: {
        'base': '4px',
        'xs':   '8px',
        'sm':   '12px',
        'md':   '16px',
        'lg':   '24px',
        'xl':   '32px',
        'touch-target': '48px',
        'input-target': '56px',
        'card-padding': '24px',
        'section-gap':  '32px',
        'gutter':       '16px',
        'margin-mobile': '20px',
      },

      // ── Shadows ────────────────────────────────────────────────────────
      boxShadow: {
        card:      '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        elevated:  '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)',
        modal:     '0 25px 50px -12px rgba(0,0,0,0.15)',
        sm:        '0 1px 2px rgba(0,0,0,0.04)',
        focus:     '0 0 0 2px #00685f',
      },

      // ── Background Images ──────────────────────────────────────────────
      backgroundImage: {
        'gradient-radial':    'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary':   'linear-gradient(135deg, #00685f, #008378)',
        'gradient-surface':   'linear-gradient(180deg, #f9f9ff 0%, #f0f3ff 100%)',
        'medical-pattern':    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5v10M5 30h10M30 45v10M45 30h10M22 22l5 5-5 5M38 22l-5 5 5 5' stroke='%2300685f' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      },

      // ── Animation ──────────────────────────────────────────────────────
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.6' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'slide-up':   'slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-down': 'slide-down 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in':    'fade-in 0.25s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
}


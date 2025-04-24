module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-dark)',
          light: 'var(--color-primary-light)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          dark: 'var(--color-secondary-dark)',
          light: 'var(--color-secondary-light)',
        },
        critical: 'var(--color-critical)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
        success: 'var(--color-success)',
      },
      backgroundColor: {
        app: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-secondary': 'var(--color-surface-secondary)',
      },
      textColor: {
        app: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)',
        }
      },
      borderColor: {
        app: 'var(--color-border)',
        'app-light': 'var(--color-border-light)',
      },
      boxShadow: {
        'app-sm': 'var(--shadow-sm)',
        'app-md': 'var(--shadow-md)',
        'app-lg': 'var(--shadow-lg)',
      },
      borderRadius: {
        'app-sm': 'var(--radius-sm)',
        'app-md': 'var(--radius-md)',
        'app-lg': 'var(--radius-lg)',
        'app-xl': 'var(--radius-xl)',
        'app-2xl': 'var(--radius-2xl)',
      },
      spacing: {
        'app-1': 'var(--space-1)',
        'app-2': 'var(--space-2)',
        'app-3': 'var(--space-3)',
        'app-4': 'var(--space-4)',
        'app-6': 'var(--space-6)',
        'app-8': 'var(--space-8)',
        'app-12': 'var(--space-12)',
        'app-16': 'var(--space-16)',
      },
      transitionProperty: {
        'theme': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      },
      transitionDuration: {
        'theme': '150ms',
      },
      transitionTimingFunction: {
        'theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
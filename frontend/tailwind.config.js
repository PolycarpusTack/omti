// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0A2540',   // donkerblauw, Mediagenix stijl
        secondary: '#F26430', // warme oranje tint
        accent: '#F0F0F0',    // lichte achtergrondkleur
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        mediagenix: {
          'primary': '#0A2540',
          'primary-focus': '#08304A',
          'primary-content': '#ffffff',
          'secondary': '#F26430',
          'secondary-focus': '#E05320',
          'secondary-content': '#ffffff',
          'accent': '#F0F0F0',
          'accent-focus': '#DCDCDC',
          'accent-content': '#000000',
          'neutral': '#3D4451',
          'neutral-focus': '#2A2E37',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#F9FAFB',
          'base-300': '#D1D5DB',
          'info': '#2094f3',
          'success': '#009485',
          'warning': '#ff9900',
          'error': '#ff5724',
        },
      },
    ],
  },
};

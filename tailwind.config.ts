import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'pastel-blue': '#A7C7E7',
        'pastel-green': '#B2D8B2',
        'pastel-purple': '#C3B1E1',
        'pastel-pink': '#F3CFC6',
        'pastel-yellow': '#FDFD96',
      },
    },
  },
  plugins: [],
}
export default config

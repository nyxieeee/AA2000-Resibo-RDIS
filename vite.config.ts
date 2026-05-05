import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'
export default defineConfig({
  plugins: [tailwindcss(), react(), mkcert()],
  server: {
    proxy: {
      '/api': {
        target: 'https://desktop-0iik0rk.tail78436b.ts.net',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

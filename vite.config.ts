import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
// mkcert enables HTTPS on the dev server so that camera/microphone APIs
// (which require a secure context) work when testing on mobile devices
// over the local network (e.g. https://192.168.x.x:5173).
export default defineConfig({
  plugins: [tailwindcss(), react(), mkcert()],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Using relative base './' so the app works seamlessly under any repository
// or folder name (e.g. /SkillSprint/, /excel_for_data_analytics/, or custom domain).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Split heavy vendors into separate cacheable chunks for faster loads.
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          charts: ['recharts'],
          export: ['xlsx', 'file-saver'],
        },
      },
    },
  },
})

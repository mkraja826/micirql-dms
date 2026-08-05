import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/portal/',
  plugins: [react()],
  build: {
    outDir: '../dist/portal',
    emptyOutDir: false,
    chunkSizeWarningLimit: 320,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.endsWith('.css')) return undefined;
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/@hey-api') || id.includes('node_modules/ws')) return 'supabase';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('/portal/src/patient-admin')) return 'patient-admin';
          if (id.includes('/portal/src/appointment-admin')) return 'appointment-admin';
          if (id.includes('/portal/src/clinical-admin')) return 'clinical-admin';
          if (id.includes('/portal/src/finance-admin')) return 'finance-admin';
          if (id.includes('/portal/src/management-admin')) return 'management-admin';
          if (id.includes('/portal/src/report-admin')) return 'report-admin';
          return undefined;
        },
      },
    },
  },
});

// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  server: {
    port: 54671,
    host: '0.0.0.0' // Allow all hosts
  },
  vite: {
    server: {
      cors: true, // Simple CORS enablement
      allowedHosts: [
        'vieraedge.com',
        'www.vieraedge.com',
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ]
    }
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: true,
    }),
  ]
});

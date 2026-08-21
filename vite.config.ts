import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icone-financas-pwa.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000
        },
        manifest: {
          name: 'FinWill Business',
          short_name: 'FinWill',
          description: 'Financeiro simples para microempreendedores individuais',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: 'icone-financas-pwa.svg?v=2',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

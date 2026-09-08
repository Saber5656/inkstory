import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';
const csp =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE || '/',
    define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version) },
    plugins: [
      react(),
      {
        name: 'privacy-csp',
        transformIndexHtml(html) {
          return html.replace(
            '<head>',
            `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`,
          );
        },
      },
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src/pwa',
        filename: 'sw.ts',
        injectRegister: false,
        registerType: 'prompt',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
          globIgnores: ['models/**'],
          maximumFileSizeToCacheInBytes: 4000000,
        },
        manifest: {
          name: 'inkstory',
          short_name: 'inkstory',
          description: 'Drawings become stories, entirely on your device.',
          theme_color: '#2e6351',
          background_color: '#faf8f1',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  };
});

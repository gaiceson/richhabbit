import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'richhabbit',
  brand: {
    displayName: '부자습관',
    primaryColor: '#D4A574',
    icon: 'https://raw.githubusercontent.com/gaiceson/richhabbit/main/public/logo.png',
  },
  web: {
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});

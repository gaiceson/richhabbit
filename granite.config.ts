import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'richhabbit',
  brand: {
    displayName: '오늘부터 부자',
    primaryColor: '#D4A574',
    icon: '',
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

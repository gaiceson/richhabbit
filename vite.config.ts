import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,  // 5173 사용 중이면 에러 (자동 포트 변경 방지)
  },
  build: {
    outDir: 'dist',
  },
  plugins: [
    {
      name: 'copy-js-dir',
      closeBundle() {
        const src = 'js';
        const dest = 'dist/js';
        mkdirSync(dest, { recursive: true });
        for (const file of readdirSync(src)) {
          if (file.endsWith('.js')) {
            copyFileSync(join(src, file), join(dest, file));
          }
        }
        console.log('[copy-js-dir] js/ → dist/web/js/ 복사 완료');
      },
    },
  ],
});

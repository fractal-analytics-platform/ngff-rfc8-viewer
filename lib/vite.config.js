import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/main.ts'),
      name: 'ngff-rfc8-viewer',
      fileName: 'ngff-rfc8-viewer'
    },
    rolldownOptions: {
      external: ['d3'],
      output: {
        globals: {
          d3: 'd3'
        }
      }
    }
  }
});

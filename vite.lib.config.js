import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';
import { terser } from 'rollup-plugin-terser';

export default defineConfig({
  plugins: [
    glsl({ include: ['**/*.glsl'], compress: false }),
    svelte({ emitCss: false, hot: false }),
  ],
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'build/lib'),
    emptyOutDir: true,
    target: 'esnext',
    // Vite does not fully minify "es" lib output, so terser runs as an output plugin.
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/apps/scan-viewer/index.js'),
      formats: ['es'],
      fileName: () => 'scan-viewer.js',
    },
    rollupOptions: {
      output: {
        plugins: [terser()],
      },
    },
  },
});

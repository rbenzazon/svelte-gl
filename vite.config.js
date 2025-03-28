import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

const entryPoints = {
  rock: 'src/rock.svelte',
  cube: 'src/cube.svelte',
  instances: 'src/instances.svelte',
  matrix: 'src/matrix.svelte',
  main: 'src/main-refactor.svelte',
  'golf-ball': 'src/golf-ball.svelte',
  venus: 'src/venus.svelte',
  gltf: 'src/gltf.svelte',
  'contact-shadow': 'src/contact-shadow.svelte',
  transparency: 'src/transparency.svelte',
  lights: 'src/lights.svelte',
  'vertex-anim': 'src/vertex-anim.svelte',
  'scene-update': 'src/scene-update.svelte',
  texture: 'src/texture.svelte',
  'skybox': 'src/skybox.svelte',
  'skybox-cube': 'src/skybox-cube.svelte',
  'draco': 'src/draco-gltf.svelte',
  'skybox-jpghdr': 'src/skybox-jpghdr.svelte',
};

// Create input object with full paths
const input = Object.fromEntries(
  Object.entries(entryPoints).map(([name, file]) => [
    name, 
    resolve(__dirname, file)
  ])
);

export default defineConfig(({ command }) => {
  const isProduction = command === 'build';

  return {
    plugins: [
      // GLSL plugin for shader files
      glsl({
        include: ['**/*.glsl'],
        compress: false,
        watch: !isProduction
      }),
      
      // Svelte plugin with same options
      svelte({
        emitCss: false,
      }),
    ],
    
    build: {
      // Don't empty the outDir (preserve assets and resources)
      emptyOutDir: false,
      
      // Target only modern browsers
      target: 'esnext',
      
      // Use Terser in production
      minify: isProduction ? 'terser' : false,
      
      // Create source maps only in development
      sourcemap: !isProduction,
      
      // Use the same output format as in rollup
      rollupOptions: {
        input,
        output: {
          dir: 'build/js',
          entryFileNames: '[name].svelte.js',
          chunkFileNames: '[name].js',
          format: 'esm',
        },
        
        // Preserve external dependencies handling
        external: [],
      },
    },
    
    // Development server configuration
    server: {
      port: 8080,
      strictPort: true,
      host: '127.0.0.1',
      
      // Serve files from the build directory for development
      fs: {
        allow: ['..'],
      },
    },
    
    // Preview server (after build)
    preview: {
      port: 8080,
      strictPort: true,
      host: '127.0.0.1',
    },
    
    // Resolve configuration to handle .svelte files
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.svelte'],
    }
  };
});
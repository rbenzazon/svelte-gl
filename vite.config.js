import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import compression from 'compression';

// HTML entry points
const htmlEntryPoints = {
  index: resolve(__dirname, 'src/index.html'),
  rock: resolve(__dirname, 'src/rock.html'),
  cube: resolve(__dirname, 'src/cube.html'),
  instances: resolve(__dirname, 'src/instances.html'),
  matrix: resolve(__dirname, 'src/matrix.html'),
  'golf-ball': resolve(__dirname, 'src/golf-ball.html'),
  venus: resolve(__dirname, 'src/venus.html'),
  gltf: resolve(__dirname, 'src/gltf.html'),
  'contact-shadow': resolve(__dirname, 'src/contact-shadow.html'),
  transparency: resolve(__dirname, 'src/transparency.html'),
  lights: resolve(__dirname, 'src/lights.html'),
  'vertex-anim': resolve(__dirname, 'src/vertex-anim.html'),
  'scene-update': resolve(__dirname, 'src/scene-update.html'),
  texture: resolve(__dirname, 'src/texture.html'),
  'skybox': resolve(__dirname, 'src/skybox.html'),
  'skybox-cube': resolve(__dirname, 'src/skybox-cube.html'),
  'draco': resolve(__dirname, 'src/draco-gltf.html'),
  'skybox-jpghdr': resolve(__dirname, 'src/skybox-jpghdr.html'),
  'text': resolve(__dirname, 'src/text.html'),
};

// Common plugins for both modes
const commonPlugins = [
  glsl({
    include: ['**/*.glsl'],
    compress: false,
    watch: true
  }),
  svelte({
    emitCss: false,
    hot: false,
  }),
  // Plugin to serve static assets from build directory
  {
    name: 'serve-static-assets',
    configureServer(server) {
      // Middleware to serve files from the build directory
      // Add compression middleware first
      server.middlewares.use(compression());
      
      server.middlewares.use((req, res, next) => {
        //console.log(req.url);
        if (req.url.endsWith('.html') || req.url.endsWith('.svelte')) {
          console.log(req.url);
          return next();
        }
  
        // Skip for JS files in build/js directory
        if (req.url.startsWith('/js/') && req.url.endsWith('.js')) {
          console.log(req.url);
          return next();
        }
        
        
        // Attempt to serve from the build directory
        const buildPath = resolve(__dirname, 'build', req.url.substring(1));
        
        if (fs.existsSync(buildPath) && fs.statSync(buildPath).isFile()) {
          console.log(req.url);
          // Determine mime type
          const ext = req.url.split('.').pop().toLowerCase();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'webp': 'image/webp',
            'json': 'application/json',
            'gltf': 'model/gltf+json',
            'glb': 'model/gltf-binary',
            'obj': 'text/plain',
            'mtl': 'text/plain',
            'bin': 'application/octet-stream',
            'hdr': 'application/octet-stream',
            'hdri': 'application/octet-stream',
            'css': 'text/css',
          };
          
          // Set content type if known
          if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
          }
          
          // Stream the file
          fs.createReadStream(buildPath).pipe(res);
        } else {
          next();
        }
      });
    }
  },
  // Plugin to handle HTML rewriting
  {
    name: 'html-history-fallback',
    configureServer(server) {
      // Add a middleware that handles URL navigation
      server.middlewares.use((req, res, next) => {
        // Get path without query string or hash
        const url = req.url.split(/[?#]/)[0];
        
        // Skip for existing files and directories
        if (url.includes('.')) {
          return next();
        }
        
        // Handle paths like /draco-gltf by serving the corresponding HTML
        const pathWithoutSlash = url.replace(/^\//, '');
        if (pathWithoutSlash && Object.keys(htmlEntryPoints).includes(pathWithoutSlash)) {
          // Rewrite the request to the HTML file
          req.url = `/${pathWithoutSlash}.html`;
          console.log(`Rewriting ${url} to ${req.url}`);
        }
        
        next();
      });
    }
  },
  {
    name: 'move-html-files-and-fix-paths',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      handler() {
        const jsDir = resolve(__dirname, 'build/js');
        const buildDir = resolve(__dirname, 'build');
        console.log("moving")
        if (fs.existsSync(jsDir)) {
          console.log('Moving HTML files from build/js to build root and fixing paths...');
          
          // Look for HTML files in build/js
          const htmlFiles = fs.readdirSync(jsDir).filter(file => file.endsWith('.html'));
          
          htmlFiles.forEach(file => {
            const source = path.join(jsDir, file);
            const destination = path.join(buildDir, file);
            
            // Read the file content
            let content = fs.readFileSync(source, 'utf8');
            
            // Fix script and link paths - update absolute paths to relative paths
            content = content.replace(
              /(src|href)="\/([^"]+)"/g, 
              (match, attr, path) => `${attr}="./js/${path}"`
            );
            
            // Write the modified file to the build root
            fs.writeFileSync(destination, content);
            
            // Remove the original file
            fs.unlinkSync(source);
            console.log(`Moved and fixed paths in: ${file}`);
          });
          
          console.log(`Processed ${htmlFiles.length} HTML files`);
        }
      }
    }
  }
];

export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build';
  
  return {
    // Root directory is src
    root: 'src',
    
    // Set the public directory to avoid conflicts
    publicDir: false,
    
    // Add common plugins
    plugins: commonPlugins,
    
    // Build configuration
    build: {
      outDir: resolve(__dirname, 'build'),
      emptyOutDir: false,
      target: 'esnext',
      minify: isProduction ? 'terser' : false,
      sourcemap: !isProduction,
      rollupOptions: {
        input: htmlEntryPoints,
        output: {
          // Output directory for built JS files
          dir: resolve(__dirname, 'build/js'),
          entryFileNames: '[name].svelte.js',
          chunkFileNames: '[name].js',
          format: 'esm',
        },
      },
    },
    
    // Development server configuration
    server: {
      port: 8080,
      strictPort: true,
      host: '127.0.0.1',
    },
    
    // Allow accessing files in build directory
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.svelte'],
    },
  };
});
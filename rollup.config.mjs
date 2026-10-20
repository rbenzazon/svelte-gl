import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import glsl from 'rollup-plugin-glsl';
import commonjs from '@rollup/plugin-commonjs';
import del from 'rollup-plugin-delete';

const dev = process.env.DEV;

const plugins = (minify = !dev) => [
    glsl({
        // By default, everything gets included
        include: 'src/**/*.glsl',
        /*sourceMap: false*/
        compress: false,
    }),
    svelte({
        emitCss: false,
    }),
    resolve({
        browser: true,
        exportConditions: ['svelte'],
        extensions: ['.svelte']
      }),
    commonjs(),
    ...(dev ? []:[terser()]),
];

export default [{
    input: {
        rock:'src/rock.svelte',
        cube:'src/cube.svelte',
        instances:'src/instances.svelte',
        matrix:'src/matrix.svelte',
        main:'src/main-refactor.svelte',
        'golf-ball':'src/golf-ball.svelte',
        venus:'src/venus.svelte',
        gltf:'src/gltf.svelte',
        'contact-shadow':'src/contact-shadow.svelte',
        transparency:'src/transparency.svelte',
        lights:'src/lights.svelte',
        'vertex-anim':'src/vertex-anim.svelte',
        'scene-update':'src/scene-update.svelte',
        texture:'src/texture.svelte',
        'skybox':'src/skybox.svelte',
        'skybox-cube':'src/skybox-cube.svelte',
        'draco':'src/draco-gltf.svelte',
        'skybox-jpghdr':'src/skybox-jpghdr.svelte',
        'two-cubes':'src/two-cubes.svelte',
        'two-cubes-html':'src/mount-cube.js',
        'data-texture':'src/data-texture.svelte',
        'camera-projection':'src/camera-projection.svelte',
        'scan-viewer':'src/scan-viewer.svelte',
    },
    output: {
        dir: 'build/js',
        entryFileNames: '[name].svelte.js',
        format: 'esm',
        chunkFileNames: '[name].js',
    },
    plugins: [del({ targets: 'build/js/*' }), ...plugins()],
}, {
    input: 'src/apps/scan-viewer/index.js',
    output: {
        file: 'build/lib/scan-viewer.js',
        format: 'esm',
    },
    plugins: plugins(),
}];

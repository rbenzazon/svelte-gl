import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import glsl from 'rollup-plugin-glsl';
import commonjs from '@rollup/plugin-commonjs';
import del from 'rollup-plugin-delete';

const dev = process.env.DEV;

export default {
    input: {
        main:'src/main-refactor.svelte',
        'golf-ball':'src/golf-ball.svelte',
        venus:'src/venus.svelte',
        cube:'src/cube.svelte',
        gltf:'src/gltf.svelte',
        rock:'src/rock.svelte',
        'contact-shadow':'src/contact-shadow.svelte',
        transparency:'src/transparency.svelte',
        instances:'src/instances.svelte',
        matrix:'src/matrix.svelte',
        texture:'src/texture.svelte',
        lights:'src/lights.svelte',
        'vertex-anim':'src/vertex-anim.svelte',
        'scene-update':'src/scene-update.svelte',
    },
    output: {
        dir: 'build/js',
        entryFileNames: '[name].svelte.js',
        format: 'esm',
    },
    plugins: [
        del({ targets: 'build/js/*' }),
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
    ]
};
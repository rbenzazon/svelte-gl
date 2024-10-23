import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import glsl from 'rollup-plugin-glsl';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'src/main-refactor.svelte',
    output: {
        file: 'build/main.svelte.js',
        format: 'esm',
    },
    plugins: [
        glsl({
            // By default, everything gets included
            include: 'src/**/*.glsl',
            /*sourceMap: false*/
            compress: false,
        }),
        svelte(),
        resolve({
            browser: true,
            exportConditions: ['svelte'],
            extensions: ['.svelte']
          }),
        commonjs(),
        terser(),
    ]
};
import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';

export default {
    input: 'src/main.svelte',
    output: {
        file: 'build/main.svelte.js',
        format: 'esm',
    },
    plugins: [
        svelte(),
        resolve({
            browser: true,
            exportConditions: ['svelte'],
            extensions: ['.svelte']
          }),
        /*terser(),*/
    ]
};
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import typescript from "@rollup/plugin-typescript";
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';

export default {
    input: 'index.js', // Entry point
    output: [
        {
            file: 'dist/index.cjs.js',
            format: 'cjs', // CommonJS format
            sourcemap: true,
        },
        {
            file: 'dist/index.esm.js',
            format: 'esm', // ES module format
            sourcemap: true,
        },
    ],
    plugins: [
        peerDepsExternal(),
        resolve({
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
        }),
        babel({
            exclude: 'node_modules/**',
            presets: ['@babel/preset-react', '@babel/preset-env'],
            babelHelpers: 'runtime',
        }),
        typescript({ tsconfig: "./tsconfig.json" }), // Compile TypeScript
        commonjs(),
        postcss({
            extensions: ['.css'],
        }),
        json(),
        terser(),
    ],
    external: [
        'react',
        'react-dom',
        // Add other dependencies that shouldn't be bundled
    ],
};
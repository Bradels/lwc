import path from 'node:path';
import fs from 'node:fs';
import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import typescript from '@rollup/plugin-typescript';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadJson = (file) => {
    const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const clean = text.replace(/\s*\/\/.*?\n/g, '');
    return JSON.parse(clean);
};
const tsconfig = loadJson('./tsconfig.json');
const lwcConfig = loadJson('./lwc.config.json');

const __ENV__ = process.env.NODE_ENV ?? 'development';

const extensions = ['.ts', '.mts', '.cts', '.d.ts', '.js', '.mjs', '.cjs'];

function getPathsInDirectory(dirname) {
    const paths = {};
    const basePath = path.resolve(__dirname, dirname);
    for (const ns of fs.readdirSync(basePath, { withFileTypes: true })) {
        if (!ns.isDirectory()) continue;
        const nsPath = path.join(basePath, ns.name);
        for (const cmp of fs.readdirSync(nsPath, { withFileTypes: true })) {
            if (!cmp.isDirectory()) continue;
            const cmpBase = path.join(nsPath, cmp.name, cmp.name);
            const ext = extensions.find((e) => fs.existsSync(cmpBase + e));
            if (!ext) continue; // component file does not exist?!
            const cmpPath = cmpBase + ext;
            const alias = `${ns.name}/${cmp.name}`;
            const resolved = '.' + path.sep + path.relative(__dirname, cmpPath);
            paths[alias] = [resolved];
        }
    }
    return paths;
}

function getPathsFromConfig() {
    const paths = {};
    for (const mod of lwcConfig.modules) {
        if (mod.dir) Object.assign(paths, getPathsInDirectory(mod.dir));
    }
    return paths;
}

export default (args) => {
    return {
        input: 'src/main.ts',

        output: {
            file: 'dist/main.js',
            format: 'esm',
            sourcemap: true,
        },

        plugins: [
            typescript({
                paths: {
                    ...getPathsFromConfig(),
                    ...tsconfig.compilerOptions.paths,
                },
            }),
            replace({
                'process.env.NODE_ENV': JSON.stringify(__ENV__),
                preventAssignment: true,
            }),
            lwc(),
            args.watch &&
                serve({
                    open: false,
                    port: 3000,
                }),
            args.watch && livereload('dist'),
        ],
    };
};

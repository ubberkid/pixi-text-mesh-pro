import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'PixiTextMeshPro',
            formats: ['es', 'cjs'],
            fileName: 'pixi-text-mesh-pro',
        },
        rollupOptions: {
            external: ['pixi.js'],
            output: {
                globals: {
                    'pixi.js': 'PIXI',
                },
            },
        },
        sourcemap: true,
    },
});

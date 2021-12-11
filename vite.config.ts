import { defineConfig } from "vite"

export default defineConfig({
    resolve: {
        alias: {
            "@wasmer/wasi/lib/polyfills/buffer": "./src/worker/buffer.ts",
        },
    },
    define: {
        "global.TYPED_ARRAY_SUPPORT": "true",
        "process.browser": "true",
    },

    build: {},
})

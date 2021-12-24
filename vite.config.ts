import { defineConfig } from "vite"

export default defineConfig({
    resolve: {
        alias: {
            "@wasmer/wasi/lib/polyfills/buffer": "./src/worker/buffer.ts",
            "web-worker": "./src/worker/buffer.ts",
            readline: "./src/worker/buffer.ts",
            // fs: "./src/worker/filesystem.ts",
        },
    },
    define: {
        "global.TYPED_ARRAY_SUPPORT": "true",
        "process.browser": "true",
        // "if (singleThread)": "if (true)",
    },
    base: "",
    build: {
        assetsDir: "",
    },
})

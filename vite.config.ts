import { defineConfig } from "vite"
import GlobalPolyfill from "@esbuild-plugins/node-globals-polyfill"
import NodeModulesPolyfills from "@esbuild-plugins/node-modules-polyfill"

export default defineConfig({
    resolve: {
        alias: {
            // "@wasmer/wasi/lib/polyfills/buffer": "./src/worker/buffer.ts",
            // "web-worker": "./src/worker/buffer.ts",
            // readline: "./src/worker/buffer.ts",
            // crypto: "./src/worker/crypto.ts",
            // constants: "./src/worker/constants.ts",
            // fs: "./src/worker/filesystem.ts",
            util: "./src/worker/util.ts",
        },
    },
    define: {
        "global.TYPED_ARRAY_SUPPORT": "true",
        "process.env.THREADS_WORKER_INIT_TIMEOUT": '""',
        "process.browser": "true",
        // "if (singleThread)": "if (true)",
    },
    base: "",
    build: {
        assetsDir: "",
        target: ["es2020"],
    },
    optimizeDeps: {
        esbuildOptions: {
            target: "es2020",
            supported: { bigint: true },
            plugins: [
                NodeModulesPolyfills(),
                GlobalPolyfill({
                    process: true,
                    buffer: true,
                }),
            ],
        },
    },
})

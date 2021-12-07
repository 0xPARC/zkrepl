import { WASI, WASIBindings, WASIExitError, WASIKillError } from "@wasmer/wasi"
import wasmURL from "circom2/circom.wasm?url"
import * as path from "path-browserify"
import wabtLoader from "wabt"
import witnessBuilder from "./witness"
import { WasmFs } from "@wasmer/wasmfs"
import { unzip } from "unzipit"
import circomLib from "../data/circomlib.zip?url"

console.log(wasmURL, circomLib)

const baseNow = Math.floor((Date.now() - performance.now()) * 1e-3)

function hrtime() {
    let clocktime = performance.now() * 1e-3
    let seconds = Math.floor(clocktime) + baseNow
    let nanoseconds = Math.floor((clocktime % 1) * 1e9)
    // return BigInt(seconds) * BigInt(1e9) + BigInt(nanoseconds)
    return (seconds * 1e9 + nanoseconds) as any
}
function randomFillSync<T>(buffer: T, offset: number, size: number): T {
    if (buffer instanceof Uint8Array) {
        for (let i = offset; i < offset + size; i++) {
            buffer[i] = Math.floor(Math.random() * 256)
        }
    }
    return buffer
}

;(globalThis as any).process = {
    cwd() {
        return ""
    },
}

const browserBindings = {
    hrtime: hrtime,
    exit: (code: number | null) => {
        throw new WASIExitError(code)
    },
    kill: (signal: string) => {
        throw new WASIKillError(signal)
    },
    randomFillSync: randomFillSync,
    isTTY: () => true,
    path: path,
    fs: null,
}

async function loadWasm(url: string) {
    const response = await fetch(url)
    const contentType = response.headers.get("Content-Type") || ""
    if (
        "instantiateStreaming" in WebAssembly &&
        contentType.startsWith("application/wasm")
    ) {
        return await WebAssembly.compileStreaming(response)
    } else {
        const buffer = await response.arrayBuffer()
        return await WebAssembly.compile(buffer)
    }
}

async function initFS() {
    const wasmFs = new WasmFs()

    const { entries } = await unzip(circomLib)

    // print all entries and their sizes
    for (const [name, entry] of Object.entries(entries)) {
        const arrayBuffer = await entries[name].arrayBuffer()
        wasmFs.fs.writeFileSync(
            name.replace("circomlib-master/circuits/", "circomlib/"),
            new Uint8Array(arrayBuffer)
        )
    }
    return wasmFs
}

const wasmFsPromise = initFS()

async function bootWasm(code: string) {
    const wasmFs = await wasmFsPromise

    wasmFs.fs.writeFileSync("/dev/stderr", "")
    wasmFs.fs.writeFileSync("/dev/stdout", "")
    wasmFs.fs.writeFileSync("example.circom", code)

    let wasi = new WASI({
        // Arguments passed to the Wasm Module
        // The first argument is usually the filepath to the executable WASI module
        // we want to run.
        args: ["circom2", "example.circom", "--wat", "--r1cs"],

        // Environment variables that are accesible to the WASI module
        env: {
            RUST_BACKTRACE: "1",
        },

        preopens: {
            ".": ".",
        },

        // Bindings that are used by the WASI Instance (fs, path, etc...)
        bindings: {
            ...browserBindings,
            fs: wasmFs.fs,
        },
    })

    const wasm = await loadWasm(wasmURL)
    let instance = await WebAssembly.instantiate(wasm, {
        ...wasi.getImports(wasm),
    })

    try {
        wasi.start(instance) // Start the WASI instance
    } catch (err) {
        console.log(err)
    }
    const stderr = wasmFs.fs.readFileSync("/dev/stderr", "utf8")

    postMessage({ type: "stderr", text: stderr })

    let stdout = await wasmFs.getStdOut()
    postMessage({ type: "stdout", text: stdout })

    // console.log(stdout)
    // console.log(stderr)

    const wabt = await wabtLoader()

    const module = wabt.parseWat(
        "example.wat",
        wasmFs.fs.readFileSync("example_js/example.wat")
    )
    module.resolveNames()
    module.validate()
    var binary = module.toBinary({})

    const witness = await witnessBuilder(binary.buffer, {
        log(message: bigint) {
            postMessage({ type: "log", text: message.toString() })
        },
    })

    const input = /\/*\s*INPUT\s*=\s*(\{[\s\S]+\})\s*\*\//.exec(code)

    let inputObj = {}
    if (input) {
        inputObj = JSON.parse(input[1])
    }
    const wtns = await witness.calculateWTNSBin(inputObj, null)
    // console.log(wtns)
}

onmessage = (e: MessageEvent) => {
    const data = e.data

    if (data.type === "run") {
        const startTime = performance.now()
        bootWasm(data.code)
            .then(() => {
                const elapsed = performance.now() - startTime
                postMessage({
                    type: "done",
                    time: elapsed,
                    text: `Finished in ${elapsed.toFixed(3)}ms`,
                })
            })
            .catch((err) => {
                postMessage({ type: "fail", text: err.message })
            })
    }
}

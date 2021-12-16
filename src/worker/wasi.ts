;(globalThis as any).process = {
    cwd() {
        return ""
    },
}
import { Buffer } from "buffer-es6"
;(globalThis as any).Buffer = Buffer

import wasmURL from "circom2/circom.wasm?url"

import { WASI, WASIExitError, WASIKillError } from "circom2/vendor/wasi"
import * as path from "path-browserify"

import { WasmFs } from "@wasmer/wasmfs"
import { unzip } from "unzipit"
import circomLib from "../data/circomlib.zip?url"

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

export const wasmFsPromise = initFS()

export async function runCircom() {
    const wasmFs = await wasmFsPromise

    let bufferSize = 10 * 1024 * 1024
    let writeBuffer = new Uint8Array(bufferSize)
    let writeBufferFd = -1
    let writeBufferOffset = 0
    let writeBufferPos = 0

    // This is a really shitty implementation of a write buffer
    // it is pretty garbage and shouldn't have any reason for working
    // but it seems to work well enough to speed up more complex
    // circuits by more than 10x
    const fsBindings = {
        ...wasmFs.fs,
        writeSync(
            fd: number,
            buf: Uint8Array,
            offset: number,
            len: number,
            pos: number
        ) {
            // console.log(pos, writeBu)
            if (
                writeBufferFd === fd &&
                writeBufferOffset + len < bufferSize &&
                pos === writeBufferPos + writeBufferOffset
            ) {
                writeBuffer.set(buf, writeBufferOffset)
                writeBufferOffset += len
                // writeBufferPos += len
                return len
            } else {
                // console.log("resetting")
                if (writeBufferFd >= 0) {
                    wasmFs.fs.writeSync(
                        writeBufferFd,
                        writeBuffer,
                        0,
                        writeBufferOffset,
                        writeBufferPos
                    )
                }
                writeBufferFd = fd
                writeBufferOffset = 0

                writeBuffer.set(buf, writeBufferOffset)
                writeBufferOffset += len
                writeBufferPos = pos
            }
            return len
        },
        closeSync(fd: number) {
            if (writeBufferFd >= 0) {
                // console.log("flush")
                wasmFs.fs.writeSync(
                    writeBufferFd,
                    writeBuffer,
                    0,
                    writeBufferOffset,
                    writeBufferPos
                )
                writeBufferFd = -1
                writeBufferOffset = 0
                writeBufferPos = 0
            }
            if (fd >= 0) {
                return wasmFs.fs.closeSync(fd)
            }
        },
    }
    let wasi = new WASI({
        // Arguments passed to the Wasm Module
        // The first argument is usually the filepath to the executable WASI module
        // we want to run.
        args: ["circom2", "main.circom", "--r1cs", "--wat", "--sym"],

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

            fs: fsBindings,
        },
    })

    const wasm = await loadWasm(wasmURL)
    let instance = await WebAssembly.instantiate(wasm, {
        ...wasi.getImports(wasm),
    })
    // console.log("starting")
    try {
        wasi.start(instance) // Start the WASI instance
    } catch (err) {
        console.log(err)
    }

    wasi.bindings.fs.closeSync(-1)
}

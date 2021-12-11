;(globalThis as any).process = {
    cwd() {
        return ""
    },
}
import { Buffer } from "buffer-es6"
;(globalThis as any).Buffer = Buffer

import { WASI, WASIExitError, WASIKillError } from "circom2/vendor/wasi"
import wasmURL from "circom2/circom.wasm?url"
import * as path from "path-browserify"
import wabtLoader from "wabt"
import witnessBuilder from "./witness"
import { WasmFs } from "@wasmer/wasmfs"
import { unzip } from "unzipit"
import circomLib from "../data/circomlib.zip?url"
import * as binFileUtils from "@iden3/binfileutils"
import { readR1csHeader } from "r1csfile"
import { Scalar, utils, BigBuffer } from "ffjavascript"

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
let wtnsFile: Uint8Array

async function bootWasm(code: string) {
    const startTime = performance.now()
    const wasmFs = await wasmFsPromise

    wasmFs.fs.writeFileSync("/dev/stderr", "")
    wasmFs.fs.writeFileSync("/dev/stdout", "")
    wasmFs.fs.writeFileSync("main.circom", code)

    let bufferSize = 10 * 1024 * 1024
    let writeBuffer = new Uint8Array(bufferSize)
    let writeBufferFd = -1
    let writeBufferOffset = 0
    let writeBufferPos = 0
    const flushBuffer = () => {}

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

            // This is a really shitty implementation of a write buffer
            // it is pretty garbage and shouldn't have any reason for working
            // but it seems to work well enough to speed up more complex
            // circuits by more than 10x
            fs: {
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
            },
        },
    })

    const wasm = await loadWasm(wasmURL)
    let instance = await WebAssembly.instantiate(wasm, {
        ...wasi.getImports(wasm),
    })
    console.log("starting")
    try {
        wasi.start(instance) // Start the WASI instance
    } catch (err) {
        console.log(err)
    }

    wasi.bindings.fs.closeSync(-1)

    const stderr = wasmFs.fs.readFileSync("/dev/stderr", "utf8")
    console.log(stderr)
    if (stderr) postMessage({ type: "stderr", text: stderr })

    let stdout = await wasmFs.getStdOut()
    postMessage({
        type: "stdout",
        text:
            stdout +
            `Compiled in ${((performance.now() - startTime) / 1000).toFixed(
                2
            )}s`,
    })

    console.log(stdout)

    const wabt = await wabtLoader()
    const watData = wasmFs.fs.readFileSync("main_js/main.wat")

    // console.log(new TextDecoder().decode(watData))
    const module = wabt.parseWat("main.wat", watData)
    module.resolveNames()
    module.validate()
    var binary = module.toBinary({})

    let logs: string[] = []
    const witness = await witnessBuilder(binary.buffer, {
        log(message: bigint) {
            logs.push(message.toString())
        },
    })

    const input = /\/*\s*INPUT\s*=\s*(\{[\s\S]+\})\s*\*\//.exec(code)

    let inputObj = {}
    if (input) {
        inputObj = JSON.parse(input[1])
    }
    wtnsFile = await witness.calculateWTNSBin(inputObj, null)

    if (logs.length > 0) postMessage({ type: "log", text: logs.join("\n") })
    // console.log(witness)

    const r1csFile = wasmFs.fs.readFileSync("main.r1cs")
    const { fd: fdR1cs, sections: sectionsR1cs } =
        await binFileUtils.readBinFile(r1csFile, "r1cs", 1, 1 << 22, 1 << 24)
    const r1cs: R1CSHeader = await readR1csHeader(fdR1cs, sectionsR1cs, false)
    await fdR1cs.close()

    if (r1cs.nOutputs > 0) {
        const { fd: fdWtns, sections: sectionsWtns } =
            await binFileUtils.readBinFile(
                wtnsFile,
                "wtns",
                2,
                1 << 25,
                1 << 23
            )

        const wtns = await readWtnsHeader(fdWtns, sectionsWtns)
        const buffWitness = await binFileUtils.readSection(
            fdWtns,
            sectionsWtns,
            2
        )

        const outputSignals = []
        for (let i = 1; i <= r1cs.nOutputs; i++) {
            const b = buffWitness.slice(i * wtns.n8, i * wtns.n8 + wtns.n8)
            outputSignals.push(Scalar.fromRprLE(b).toString())
        }

        postMessage({
            type: "Output",
            text: outputSignals.join("\n"),
        })

        await fdWtns.close()
    }
    console.log(r1cs)

    postMessage({
        type: "Artifacts",
        text: "",
        files: {
            "main.wtns": wtnsFile,
            "main.wasm": binary.buffer,
            "main.r1cs": r1csFile,
        },
    })

    const elapsed = performance.now() - startTime
    postMessage({
        type: "done",
        time: elapsed,
        text: `Finished in ${(elapsed / 1000).toFixed(2)}s`,
    })
}

type R1CSHeader = {
    curve: any
    n8: number
    nConstraints: number
    nLabels: number
    nOutputs: number
    nPrvInputs: number
    nPubInputs: number
    nVars: number
    prime: bigint
}

async function handleHover(symbol: string) {
    const wasmFs = await wasmFsPromise
    const symFile = wasmFs.fs.readFileSync("main.sym", "utf8")
    for (let line of symFile.split("\n")) {
        const parts = line.split(",")
        if (parts[3].endsWith(symbol)) {
            const { fd: fdWtns, sections: sectionsWtns } =
                await binFileUtils.readBinFile(
                    wtnsFile,
                    "wtns",
                    2,
                    1 << 25,
                    1 << 23
                )

            const wtns = await readWtnsHeader(fdWtns, sectionsWtns)
            const buffWitness = await binFileUtils.readSection(
                fdWtns,
                sectionsWtns,
                2
            )

            const signalIndex = parseInt(line[0])
            const b = buffWitness.slice(
                signalIndex * wtns.n8,
                signalIndex * wtns.n8 + wtns.n8
            )
            postMessage({ type: "hover", text: Scalar.fromRprLE(b).toString() })

            await fdWtns.close()

            return
        }
    }
    // console.log(symFile)
}

onmessage = (e: MessageEvent) => {
    const data = e.data

    if (data.type === "run") {
        bootWasm(data.code).catch((err) => {
            postMessage({ type: "fail", text: err.message })
        })
    } else if (data.type === "hover") {
        handleHover(data.symbol).catch((err) => {})
    }
}

export async function readWtnsHeader(
    fd: any,
    sections: any
): Promise<{
    n8: number
    q: bigint
    nWitness: number
}> {
    await binFileUtils.startReadUniqueSection(fd, sections, 1)
    const n8 = await fd.readULE32()
    const q = await binFileUtils.readBigInt(fd, n8)
    const nWitness = await fd.readULE32()
    await binFileUtils.endReadSection(fd)
    return { n8, q, nWitness }
}

;(globalThis as any).process = {
    cwd() {
        return ""
    },
}
import { Buffer } from "buffer-es6"
;(globalThis as any).Buffer = Buffer

import { WASI, WASIExitError, WASIKillError } from "circom2/vendor/wasi"
import * as path from "path-browserify"
import { WasmFs } from "@wasmer/wasmfs"
import { unzip } from "unzipit"

import circomLib from "../data/circomlib.zip?url"
import wasmURL from "circom2/circom.wasm?url"

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
        wasmFs.fs.writeFileSync(
            name.replace("circomlib-master/circuits/", "circomlib/circuits/"),
            new Uint8Array(arrayBuffer)
        )
    }
    return wasmFs
}

export const wasmFsPromise = initFS()

export function replaceExternalIncludes(code: string) {
    return code.replace(/(include\s+")([^"]+)"/g, (all, prefix, fileName) => {
        if (fileName.startsWith("gist:"))
            return (
                prefix +
                fileName.replace("gist:", "external/https/gist.github.com/") +
                '"'
            )
        return all.replace(/(include\s+")(\w+):\/\//, "$1external/$2/")
    })
}

export async function runCircom(
    fileName: string = "main.circom",
    options = {
        nosym: false,
        nowasm: false,
        nor1cs: false,
    }
) {
    const wasmFs = await wasmFsPromise

    let bufferSize = 10 * 1024 * 1024
    let writeBuffer = new Uint8Array(bufferSize)
    let writeBufferFd = -1
    let writeBufferOffset = 0
    let writeBufferPos = 0

    let fetchExternalResource: string | undefined

    // This is a really shitty implementation of a write buffer
    // it is pretty garbage and shouldn't have any reason for working
    // but it seems to work well enough to speed up more complex
    // circuits by more than 10x
    const fsBindings = {
        ...wasmFs.fs,
        realpathSync(path: string) {
            // console.log("realpathSync>>", path)
            const clr = path.replace(/.*circomlib\//, "circomlib/")
            if (path.includes("circomlib/") && wasmFs.fs.existsSync(clr))
                return clr
            if (path.startsWith("external/") && !wasmFs.fs.existsSync(path)) {
                fetchExternalResource = path
            }
            return wasmFs.fs.realpathSync(path)
        },
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

    const wasm = await loadWasm(wasmURL)
    while (true) {
        let wasi = new WASI({
            // Arguments passed to the Wasm Module
            // The first argument is usually the filepath to the executable WASI module
            // we want to run.
            args: [
                "circom2",
                fileName,
                !options.nor1cs && "--r1cs",
                !options.nowasm && "--wasm",
                !options.nosym && "--sym",
            ].filter((k) => k !== false) as string[],

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
                // path: {
                //     ...browserBindings.path,
                //     resolve(base, file) {
                //         console.log("resolve", base, file)
                //         return browserBindings.path.resolve(base, file)
                //     },
                // },
                fs: fsBindings,
                // fs: new Proxy(fsBindings, {
                //     get(target, prop, rec) {
                //         if (
                //             typeof target[prop] === "function" &&
                //             prop !== "writeSync"
                //         ) {
                //             return (...args) => {
                //                 console.log(prop, args)
                //                 return target[prop](...args)
                //             }
                //         }
                //         return target[prop]
                //     },
                // }),
            },
        })
        fetchExternalResource = undefined

        wasi.bindings.fs.writeFileSync("/dev/stderr", "")
        wasi.bindings.fs.writeFileSync("/dev/stdout", "")

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
        if (fetchExternalResource) {
            console.log("Fetching", fetchExternalResource)
            const res = await fetchResource(fetchExternalResource)
            const code = replaceExternalIncludes(removeMainComponent(res))

            wasi.bindings.fs.mkdirSync(path.dirname(fetchExternalResource), {
                recursive: true,
            })
            wasi.bindings.fs.writeFileSync(fetchExternalResource, code)
            continue
        }

        break
    }
}

function removeMainComponent(code: string) {
    return code.replace(/(component\s+main[^;]+;)/, "/* $1 */")
}

async function fetchText(url: string) {
    let req
    try {
        req = await fetch(url)
    } catch (err) {
        throw new Error(`Failed to fetch ${url}`)
    }
    if (req.status !== 200) throw new Error(`Error ${req.status}: ${url}`)
    return await req.text()
}

async function fetchGist(gistId: string) {
    const gist = await fetch(`https://api.github.com/gists/${gistId}`)
    const gistData = await gist.json()
    if (gistData.files["main.circom"])
        return gistData.files["main.circom"].content

    const circomFile = Object.keys(gistData.files).find((k) =>
        k.endsWith(".circom")
    )
    if (circomFile) return gistData.files[circomFile!].content

    return Object.values(gistData.files as Record<string, any>)[0].content
}

async function fetchResource(path: string) {
    let url
    let m: RegExpMatchArray = []

    const match = (re: RegExp) => (m = re.exec(path)!)
    // https://gist.github.com/antimatter15/36a5facb7f629eb9ee93f0e623f5dbb5
    if (match(/^external\/https\/gist\.github\.com\/([^/]+)\/([\da-f]{32})/)) {
        return fetchGist(m[2])
    }

    if (match(/^external\/https\/gist\.github\.com\/([\da-f]{32})/)) {
        return fetchGist(m[1])
    }

    // 'external/https/github.com/0xPARC/zk-group-sigs/blob/master/circuits/deny.circom'
    if (
        match(
            /^external\/https\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)/
        )
    ) {
        // https://raw.githubusercontent.com/0xPARC/zk-group-sigs/master/circuits/deny.circom
        return fetchText(
            `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`
        )
    }

    if (match(/^external\/ipfs\/(.*)$/))
        return fetchText(`https://cloudflare-ipfs.com/ipfs/${m[1]}`)
    if (match(/^external\/dweb\/ipfs\/(.*)$/))
        return fetchText(`https://cloudflare-ipfs.com/ipfs/${m[1]}`)
    if (match(/^external\/https\/(.*)$/)) return fetchText(`https://${m[1]}`)
    if (match(/^external\/http\/(.*)$/)) return fetchText(`http://${m[1]}`)
}

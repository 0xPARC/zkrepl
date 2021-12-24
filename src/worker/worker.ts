import wabtLoader from "wabt"
import witnessBuilder from "./witness"
import { runCircom, wasmFsPromise } from "./wasi"
import * as binFileUtils from "@iden3/binfileutils"
import { readR1csHeader } from "r1csfile"
import { Scalar } from "ffjavascript"
// import { buildThreadManager } from "ffjavascript/src/threadman"

// console.log(buildThreadManager)
// import { newZKey } from "snarkjs"
import { zKey } from "snarkjs"

let wtnsFile: Uint8Array

async function bootWasm(code: string) {
    const wasmFs = await wasmFsPromise
    const startTime = performance.now()

    for (let m of code.matchAll(/include\s+"([^"]+)"/g)) {
        const fileName = m[1]
        console.log(fileName)
        if (fileName.startsWith("gist:") && !wasmFs.fs.existsSync(fileName)) {
            const gistId = m[1].substr(5)
            const gist = await fetch(`https://api.github.com/gists/${gistId}`)
            const gistData = await gist.json()
            const gistFile = gistData.files["main.circom"].content.replace(
                /component\s+main[^;]+;/,
                "/* $1 */"
            )
            wasmFs.fs.writeFileSync(fileName, gistFile)
        }
    }

    wasmFs.fs.writeFileSync("/dev/stderr", "")
    wasmFs.fs.writeFileSync("/dev/stdout", "")
    wasmFs.fs.writeFileSync("main.circom", code)

    await runCircom()

    const stderr = wasmFs.fs.readFileSync("/dev/stderr", "utf8")
    // console.log(stderr)
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

    // console.log(stdout)

    const wabt = await wabtLoader()
    const watData = wasmFs.fs.readFileSync("main_js/main.wat")

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

    const r1csFile = wasmFs.fs.readFileSync("main.r1cs")
    const { fd: fdR1cs, sections: sectionsR1cs } =
        await binFileUtils.readBinFile(r1csFile, "r1cs", 1, 1 << 22, 1 << 24)
    const r1cs = await readR1csHeader(
        fdR1cs,
        sectionsR1cs,
        /* singleThread */ true
    )
    await fdR1cs.close()

    const input = /\/*\s*INPUT\s*=\s*(\{[\s\S]+\})\s*\*\//.exec(code)
    let inputObj: Record<string, string | string[]> = {}
    if (input) {
        inputObj = JSON.parse(input[1])
    } else if (r1cs.nPrvInputs + r1cs.nPubInputs > 0) {
        postMessage({
            type: "stderr",
            text: `To specify inputs, add to your circuit: \n\nINPUT = { "a": "1234" }`,
        })
    }

    wtnsFile = await witness.calculateWTNSBin(inputObj, true)

    if (logs.length > 0) postMessage({ type: "log", text: logs.join("\n") })
    // console.log(witness)

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

        const symFile = wasmFs.fs.readFileSync("main.sym") as Uint8Array
        let lastPos = 0
        let dec = new TextDecoder("utf-8")
        let outputPrefixes: Record<number, string> = {}
        for (let i = 0; i < symFile.length; i++) {
            if (symFile[i] === 0x0a) {
                let line = dec.decode(symFile.slice(lastPos, i))
                let wireNo = +line.split(",")[0]

                if (wireNo <= r1cs.nOutputs) {
                    outputPrefixes[wireNo] =
                        line.split(",")[3].replace("main.", "") + " = "
                }

                lastPos = i
            }
        }

        let outputSignals = []
        for (let i = 1; i <= r1cs.nOutputs; i++) {
            const b = buffWitness.slice(i * wtns.n8, i * wtns.n8 + wtns.n8)
            const outputPrefix = outputPrefixes[i] || ""
            outputSignals.push(outputPrefix + Scalar.fromRprLE(b).toString())
        }
        postMessage({
            type: "Output",
            text: outputSignals.join("\n"),
        })

        await fdWtns.close()
    }
    // console.log(r1cs)

    postMessage({
        type: "Artifacts",
        text: "",
        files: {
            "main.wasm": binary.buffer,
            "main.js": wasmFs.fs.readFileSync("main_js/witness_calculator.js"),
            "main.wtns": wtnsFile,
            "main.r1cs": r1csFile,
            "main.sym": wasmFs.fs.readFileSync("main.sym"),
        },
    })

    const elapsed = performance.now() - startTime
    postMessage({
        type: "done",
        time: elapsed,
        text: `Finished in ${(elapsed / 1000).toFixed(2)}s`,
    })
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
}

async function handleHover(symbol: string) {
    const wasmFs = await wasmFsPromise

    let symbolMatcherRe = new RegExp("\\b" + escapeRegExp(symbol) + "(\\b|$)")
    let symbolMatcher = (k: string) => symbolMatcherRe.test(k)
    let results: string[] = []

    const symFile = wasmFs.fs.readFileSync("main.sym") as Uint8Array
    let lastPos = 0
    let dec = new TextDecoder("utf-8")

    for (let i = 0; i < symFile.length; i++) {
        if (symFile[i] !== 0x0a) continue
        let line = dec.decode(symFile.slice(lastPos, i))
        const parts = line.split(",")

        if (parts[3] && symbolMatcher(parts[3])) {
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
            results.push(
                "*" +
                    parts[3].replace("main.", "") +
                    " =* " +
                    Scalar.fromRprLE(b).toString()
            )

            await fdWtns.close()

            if (results.length > 3) {
                results.push("...")
                break
            }
        }

        lastPos = i + 1
    }

    postMessage({ type: "hover", text: results.join("\n\n") })
    // console.log(symFile)
}

onmessage = (e: MessageEvent) => {
    const data = e.data

    if (data.type === "run") {
        bootWasm(data.code).catch((err) => {
            postMessage({ type: "fail", text: err.message })
        })
    } else if (data.type === "hover") {
        handleHover(data.symbol).catch((err) => {
            console.log("hover err", err)
            postMessage({ type: "hover", text: "" })
        })
    } else if (data.type === "phase2") {
        generateProvingKey().catch((err) => {
            postMessage({ type: "fail", text: err.message })
        })
    }
}

async function generateProvingKey() {
    const wasmFs = await wasmFsPromise
    const r1csFile = wasmFs.fs.readFileSync("main.r1cs")
    const { fd: fdR1cs, sections: sectionsR1cs } =
        await binFileUtils.readBinFile(r1csFile, "r1cs", 1, 1 << 22, 1 << 24)
    const r1cs = await readR1csHeader(
        fdR1cs,
        sectionsR1cs,
        /* singleThread */ true
    )
    await fdR1cs.close()

    const pots = [
        // {
        //     url: "https://dweb.link/ipfs/bafybeierwc3pmc2id2zfpgb42njkzvvvj4s333dcq4gr5ri2ixa6vuxi6a",
        //     name: "powersOfTau28_hez_final_11.ptau",
        //     maxConstraints: 1 << 11,
        //     size: 2442392,
        // },
        // {
        //     url: "https://cloudflare-ipfs.com/ipfs/bafybeibyoizq4sfp7sfomoofgczak3lgispbvviljjgdpchsxjrb4p6qsi",
        //     name: "powersOfTau28_hez_final_12.ptau",
        //     maxConstraints: 1 << 12,
        //     size: 4801688,
        // },
        // {
        //     url: "https://cloudflare-ipfs.com/ipfs/bafybeiderqjodw2mc6m5fqnc7edsun5eu4niupyw3cdsiruospa66y5vam",
        //     name: "powersOfTau28_hez_final_13.ptau",
        //     maxConstraints: 1 << 13,
        //     size: 9520280,
        // },
        {
            url: "https://cloudflare-ipfs.com/ipfs/bafybeihuh2cuustfaraum3txs2scrl5vaukkc6u5ztf27jlyx5xhtsz5ti",
            name: "powersOfTau28_hez_final_14.ptau",
            maxConstraints: 1 << 14,
            size: 18957464,
        },
        {
            url: "https://dweb.link/ipfs/bafybeihfv3pmjkfmefpwdxwmxxqtsax4ljshnhl3qai4v62q5r2wszix34",
            name: "powersOfTau28_hez_final_15.ptau",
            maxConstraints: 1 << 15,
            size: 37831832,
        },
        {
            url: "https://cloudflare-ipfs.com/ipfs/bafybeiajy6lpqym5fvszu4klbzoqzljwhv4ocxvqmwvlwrg6pd6rieggd4",
            name: "powersOfTau28_hez_final_16.ptau",
            maxConstraints: 1 << 16,
            size: 75580568,
        },
        {
            url: "https://cloudflare-ipfs.com/ipfs/bafybeib6a55iwy4666wxcwo7vy756sn36cwyx7u2u5idqcjxopwa7wpb3m",
            name: "powersOfTau28_hez_final_17.ptau",
            maxConstraints: 1 << 17,
            size: 151078040,
        },
        {
            url: "https://dweb.link/ipfs/bafybeidmnn4gwlirvok6vllpu4b7hkgheyemmptmeqgmhk3ony6aanv77e",
            name: "powersOfTau28_hez_final_18.ptau",
            maxConstraints: 1 << 18,
            size: 302072984,
        },
    ]

    const pot = pots.find((p) => p.maxConstraints >= r1cs.nConstraints)
    if (!pot)
        throw new Error(
            "No powers of tau supported for " +
                r1cs.nConstraints +
                " constraints"
        )
    console.log(r1cs.nConstraints, pot)
    postMessage({
        type: "progress",
        fraction: null,
    })
    const response = await fetch(pot.url)
    let loaded = 0

    const res = new Response(
        new ReadableStream({
            async start(controller) {
                const reader = response.body!.getReader()
                for (;;) {
                    const { done, value } = await reader.read()
                    if (done) break
                    loaded += value!.byteLength
                    // progress({loaded, total})
                    // console.log(loaded, total)
                    postMessage({
                        type: "progress",
                        fraction: loaded / pot.size,
                    })
                    controller.enqueue(value)
                }
                controller.close()
            },
        })
    )
    const ptauArray = new Uint8Array(await res.arrayBuffer())

    let zKeyLog: string[] = []
    const zKeyResult = await zKey.newZKey(
        r1csFile,
        ptauArray,
        { type: "mem" },
        {
            info(str: string) {
                zKeyLog.push(str)
                console.log("INFO", str)
            },
            warn(str: string) {
                console.log("WARN", str)
            },
            debug(str: string) {
                // console.log("DEBUG", str)
            },
            error(str: string) {
                console.log("ERROR", str)
            },
        }
    )
    console.log("ZKEY", zKeyResult)
    // console.log(arr, newZKey)
    // postMessage({
    //     type: "log",
    //     text: zKeyLog.join("\n"),
    // })
    postMessage({
        type: "keys",
        files: {
            "main.zkey": zKeyResult,
        },
    })
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

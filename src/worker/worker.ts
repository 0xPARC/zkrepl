import wabtLoader from "wabt"
import witnessBuilder from "./witness"
import { runCircom, wasmFsPromise } from "./wasi"
import * as binFileUtils from "@iden3/binfileutils"
import { readR1csHeader } from "r1csfile"
import { Scalar } from "ffjavascript"

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
        const numInputs = Object.keys(inputObj)
            .map((k) => (Array.isArray(inputObj[k]) ? inputObj[k].length : 1))
            .reduce((a, b) => a + b, 0)
        if (r1cs.nPrvInputs + r1cs.nPubInputs > numInputs) {
            postMessage({
                type: "stderr",
                text: `Expected ${r1cs.nPrvInputs} private inputs and ${r1cs.nPubInputs} public inputs, but only found ${numInputs} inputs`,
            })
        }
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
        const symFile = (
            wasmFs.fs.readFileSync("main.sym", "utf8") as string
        ).split("\n")

        const outputSignals = []
        for (let i = 1; i <= r1cs.nOutputs; i++) {
            let outputPrefix = ""
            const outputLine = symFile.find((k) => k.split(",")[0] === i + "")
            // parts = [labelIndex, varIndex, componentIndex, name]
            if (outputLine) {
                outputPrefix =
                    outputLine.split(",")[3].replace("main.", "") + " = "
            }

            const b = buffWitness.slice(i * wtns.n8, i * wtns.n8 + wtns.n8)
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
            "main.wtns": wtnsFile,
            "main.wasm": binary.buffer,
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
    const symFile = wasmFs.fs.readFileSync("main.sym", "utf8") as string
    // let symbolMatcher = (k: string) => k.endsWith(symbol)
    let symbolMatcherRe = new RegExp("\\b" + escapeRegExp(symbol) + "(\\b|$)")
    let symbolMatcher = (k: string) => symbolMatcherRe.test(k)
    let results: string[] = []

    // console.log(symFile)
    for (let line of symFile.split("\n")) {
        const parts = line.split(",")
        // parts = [labelIndex, varIndex, componentIndex, name]

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
            // console.log(signalIndex, Array.from(b), parts, buffWitness)

            await fdWtns.close()

            if (results.length > 3) {
                results.push("...")
                break
            }
        }
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

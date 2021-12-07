import React from "react"
import * as monaco from "monaco-editor/esm/vs/editor/editor.api"
import "./syntax"
import codeExample from "./data/example.circom?raw"
import CircomWorker from "./worker/worker?worker"
import Ansi from "ansi-to-react"
import "monaco-editor/esm/vs/editor/browser/controller/coreCommands.js"
import "monaco-editor/esm/vs/editor/contrib/comment/comment.js"
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/bracketMatching.js"
import "monaco-editor/esm/vs/editor/contrib/folding/folding.js"

// this is a workaround for what seems to be some kind of bug around
// importing raw urls from webworkers in production builds
import wasmURL from "circom2/circom.wasm?url"
import circomLib from "./data/circomlib.zip?url"
console.log(circomLib, wasmURL)

type Message = {
    type: string
    text: string
}

export default function App() {
    const [running, setRunning] = React.useState(false)
    const [messages, setMessages] = React.useState<Message[]>([])
    const [editor, setEditor] =
        React.useState<monaco.editor.IStandaloneCodeEditor | null>(null)
    const monacoEl = React.useRef(null)
    const workerRef = React.useRef<Worker | null>(null)

    React.useEffect(() => {
        if (monacoEl && !editor) {
            const editor = monaco.editor.create(monacoEl.current!, {
                value: codeExample,
                language: "circom",
                automaticLayout: true, // the important part
            })
            const run = () => {
                if (!workerRef.current) {
                    workerRef.current = new CircomWorker()
                    workerRef.current.onmessage = (e: MessageEvent) => {
                        const data = e.data
                        if (data.type === "fail") {
                            setRunning(false)
                        } else if (data.type === "done") {
                            setRunning(false)
                            // console.log(data.time)
                        }
                        setMessages((k) => [...k, data])
                    }
                }
                setRunning(true)
                setMessages([])
                workerRef.current.postMessage({
                    type: "run",
                    code: editor.getValue(),
                })
            }
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run)
            editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, run)
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period,
                function () {
                    console.log("Abort kernel!")
                    setRunning(false)
                    if (workerRef.current) {
                        workerRef.current.terminate()
                        workerRef.current = null
                    }
                }
            )
            run()
            setEditor(editor)
        }

        return () => editor?.dispose()
    }, [monacoEl.current])
    return (
        <div className="layout">
            <div className="editor" ref={monacoEl}></div>
            <div className="sidebar">
                <div className="output">
                    <div className="label">
                        Press Shift-Enter to compile and run Circom code
                    </div>
                    <br />
                    {messages.map((m, i) => (
                        <div key={i}>
                            <div className="label">{m.type}: </div>
                            <Ansi>{m.text}</Ansi>
                        </div>
                    ))}
                    {running ? (
                        <div className="loading">
                            <div className="lds-ellipsis">
                                <div></div>
                                <div></div>
                                <div></div>
                                <div></div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

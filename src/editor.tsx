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
    files?: Record<string, Uint8Array>
}

export default function App() {
    const [running, setRunning] = React.useState(false)
    const [messages, setMessages] = React.useState<Message[]>([])
    const [editor, setEditor] =
        React.useState<monaco.editor.IStandaloneCodeEditor | null>(null)
    const monacoEl = React.useRef(null)
    const workerRef = React.useRef<(Worker & { running?: boolean }) | null>(
        null
    )

    React.useEffect(() => {
        if (monacoEl && !editor) {
            const OAuthCode = new URLSearchParams(location.search).get("code")
            if (OAuthCode) {
                history.replaceState(null, "", "/")
                fetch(
                    "https://kikks470wl.execute-api.us-west-1.amazonaws.com/access_token?code=" +
                        OAuthCode,
                    { method: "POST" }
                )
                    .then((k) => k.formData())
                    .then((k) => {
                        if (k.get("access_token")) {
                            localStorage.GithubAccessToken =
                                k.get("access_token")
                            editor
                                .getModel()!
                                .setValue(
                                    localStorage.GithubNavigationCodeSnapshot
                                )
                            save()
                        } else {
                            alert("Failed to get access token")
                        }
                    })
            }

            const GistID = new URLSearchParams(location.search).get("gist")
            if (GistID) {
                fetch("https://api.github.com/gists/" + GistID)
                    .then((data) => data.json())
                    .then((data) => {
                        editor
                            .getModel()!
                            .setValue(
                                data?.files?.["main.circom"]?.content ||
                                    "// Unable to load gist"
                            )
                        run()
                    })
            }

            const editor = monaco.editor.create(monacoEl.current!, {
                value: GistID ? "// Loading from Github..." : codeExample,
                language: "circom",
                automaticLayout: true, // the important part
            })

            const run = () => {
                if (!workerRef.current || workerRef.current!.running) {
                    if (workerRef.current) {
                        workerRef.current.terminate()
                        workerRef.current = null
                    }
                    workerRef.current = new CircomWorker()
                    workerRef.current.onmessage = (e: MessageEvent) => {
                        const data = e.data
                        if (data.type === "fail") {
                            setRunning(false)
                            workerRef.current!.running = false
                        } else if (data.type === "done") {
                            setRunning(false)
                            workerRef.current!.running = false
                        }
                        setMessages((k) => [...k, data])
                    }
                    workerRef.current.onerror = (e) => {
                        console.error(e)
                        setMessages((k) => [
                            ...k,
                            {
                                type: "error",
                                text: e.message,
                            },
                        ])
                    }
                }
                workerRef.current!.running = true
                setRunning(true)
                setMessages([])
                workerRef.current.postMessage({
                    type: "run",
                    code: editor.getValue(),
                })
            }

            const save = () => {
                const GistID = new URLSearchParams(location.search).get("gist")
                const logIn = () => {
                    localStorage.GithubNavigationCodeSnapshot =
                        editor.getValue()
                    location.href =
                        "https://github.com/login/oauth/authorize?client_id=85123c5a3a8a8f73f015&scope=gist"
                }
                if (localStorage.GithubAccessToken) {
                    setRunning(true)
                    fetch(
                        GistID
                            ? "https://api.github.com/gists/" + GistID
                            : "https://api.github.com/gists",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                files: {
                                    "main.circom": {
                                        content: editor.getValue(),
                                    },
                                },
                            }),
                            headers: {
                                Authorization:
                                    "token " + localStorage.GithubAccessToken,
                            },
                        }
                    )
                        .then((k) => k.json())
                        .then((k) => {
                            if (k.id) {
                                history.replaceState(null, "", "/?gist=" + k.id)
                            } else if (k.message === "Bad credentials") {
                                logIn()
                            }
                            setRunning(false)
                        })
                } else {
                    logIn()
                }
            }
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save)
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
            if (!GistID) run()
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
                        Shift-Enter to run. Cmd-S to save to Github Gists.
                    </div>
                    <br />
                    {messages.map((m, i) => (
                        <div key={i}>
                            <div className="label">{m.type}: </div>
                            <Ansi>{m.text}</Ansi>
                            {m.files && (
                                <div className="files">
                                    {Object.entries(m.files).map(
                                        ([name, data]) => (
                                            <li key={name}>
                                                <a
                                                    href={URL.createObjectURL(
                                                        new Blob([data], {
                                                            type: "application/octet-stream",
                                                        })
                                                    )}
                                                    download={name}
                                                >
                                                    {name}
                                                </a>{" "}
                                                (
                                                {(data.length / 1000).toFixed(
                                                    2
                                                )}
                                                KB)
                                            </li>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {running ? <LoadingIndicator /> : null}
                </div>
            </div>
        </div>
    )
}

function LoadingIndicator() {
    const [time, setTime] = React.useState(0)
    React.useEffect(() => {
        const startTime = Date.now()
        const interval = setInterval(() => {
            setTime(Date.now() - startTime)
        }, 16)
        return () => clearInterval(interval)
    }, [])
    return (
        <div className="loading">
            <div className="lds-ellipsis">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            <div className="time">{(time / 1000).toFixed(2)}s</div>
        </div>
    )
}

import React from "react"

import "monaco-editor/esm/vs/editor/browser/controller/coreCommands.js"
// import 'monaco-editor/esm/vs/editor/browser/widget/codeEditorWidget.js';
// import 'monaco-editor/esm/vs/editor/browser/widget/diffEditorWidget.js';
// import 'monaco-editor/esm/vs/editor/browser/widget/diffNavigator.js';
// import 'monaco-editor/esm/vs/editor/contrib/anchorSelect/anchorSelect.js';
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/bracketMatching.js"
import "monaco-editor/esm/vs/editor/contrib/caretOperations/caretOperations.js"
// import 'monaco-editor/esm/vs/editor/contrib/caretOperations/transpose.js';
import "monaco-editor/esm/vs/editor/contrib/clipboard/clipboard.js"
// import 'monaco-editor/esm/vs/editor/contrib/codeAction/codeActionContributions.js';
// import 'monaco-editor/esm/vs/editor/contrib/codelens/codelensController.js';
// import 'monaco-editor/esm/vs/editor/contrib/colorPicker/colorContributions.js';
import "monaco-editor/esm/vs/editor/contrib/comment/comment.js"
import "monaco-editor/esm/vs/editor/contrib/contextmenu/contextmenu.js"
import "monaco-editor/esm/vs/editor/contrib/cursorUndo/cursorUndo.js"
// import 'monaco-editor/esm/vs/editor/contrib/dnd/dnd.js';
// import 'monaco-editor/esm/vs/editor/contrib/documentSymbols/documentSymbols.js';
import "monaco-editor/esm/vs/editor/contrib/find/findController.js"
import "monaco-editor/esm/vs/editor/contrib/folding/folding.js"
import "monaco-editor/esm/vs/editor/contrib/fontZoom/fontZoom.js"
// import 'monaco-editor/esm/vs/editor/contrib/format/formatActions.js';
// import 'monaco-editor/esm/vs/editor/contrib/gotoError/gotoError.js';
// import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/goToCommands.js';
// import 'monaco-editor/esm/vs/editor/contrib/gotoSymbol/link/goToDefinitionAtPosition.js';
import "monaco-editor/esm/vs/editor/contrib/hover/hover.js"
// import 'monaco-editor/esm/vs/editor/contrib/inPlaceReplace/inPlaceReplace.js';
import "monaco-editor/esm/vs/editor/contrib/indentation/indentation.js"
// import 'monaco-editor/esm/vs/editor/contrib/inlineHints/inlineHintsController.js';
// import 'monaco-editor/esm/vs/editor/contrib/linesOperations/linesOperations.js';
// import 'monaco-editor/esm/vs/editor/contrib/linkedEditing/linkedEditing.js';
// import 'monaco-editor/esm/vs/editor/contrib/links/links.js';
import "monaco-editor/esm/vs/editor/contrib/multicursor/multicursor.js"
// import 'monaco-editor/esm/vs/editor/contrib/parameterHints/parameterHints.js';
// import 'monaco-editor/esm/vs/editor/contrib/rename/rename.js';
// import 'monaco-editor/esm/vs/editor/contrib/smartSelect/smartSelect.js';
// import 'monaco-editor/esm/vs/editor/contrib/snippet/snippetController2.js';
// import 'monaco-editor/esm/vs/editor/contrib/suggest/suggestController.js';
// import 'monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/toggleTabFocusMode.js';
// import 'monaco-editor/esm/vs/editor/contrib/unusualLineTerminators/unusualLineTerminators.js';
// import 'monaco-editor/esm/vs/editor/contrib/viewportSemanticTokens/viewportSemanticTokens.js';
// import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/wordHighlighter.js';
// import 'monaco-editor/esm/vs/editor/contrib/wordOperations/wordOperations.js';
// import 'monaco-editor/esm/vs/editor/contrib/wordPartOperations/wordPartOperations.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/accessibilityHelp/accessibilityHelp.js';
import "monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js"
// import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js';

import "./syntax"
import codeExample from "./data/example.circom?raw"
import CircomWorker from "./worker/worker?worker"
import Ansi from "ansi-to-react"

import * as monaco from "monaco-editor/esm/vs/editor/editor.api"

// this is a workaround for what seems to be some kind of bug around
// importing raw urls from webworkers in production builds
import wasmURL from "circom2/circom.wasm?url"
import circomLib from "./data/circomlib.zip?url"

import { replyHover } from "./syntax"
console.log(circomLib, wasmURL)

type Message = {
    type: string
    text: string
    files?: Record<string, Uint8Array>
    url?: string
}

export var circomWorker: Worker

export default function App() {
    const [running, setRunning] = React.useState<false | number>(false)
    const [messages, setMessages] = React.useState<Message[]>([])
    const [editor, setEditor] =
        React.useState<monaco.editor.IStandaloneCodeEditor | null>(null)
    const modelsRef = React.useRef<monaco.editor.ITextModel[]>([]);
    const monacoEl = React.useRef(null)
    const workerRef = React.useRef<(Worker & { running?: boolean }) | null>(
        null
    )
    const [progress, setProgress] = React.useState(1)
    const editorState: Record<string, monaco.editor.ICodeEditorViewState> = {}
    const GistID = new URLSearchParams(location.search).get("gist")

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

            if (GistID) {
                fetch("https://api.github.com/gists/" + GistID)
                    .then((data) => data.json())
                    .then((data) => {
                        const tmpModels: monaco.editor.ITextModel[] = []
                        for (const key in data?.files) {
                            const model = monaco.editor.createModel(data?.files[key].content || "// Unable to load gist",
                                "circom", new monaco.Uri().with({path: key}))
                            tmpModels.push(model)
                        }
                        modelsRef.current = tmpModels;
                        editor.setModel(tmpModels[0]);
                        run()
                    })
            }

            const editor = monaco.editor.create(monacoEl.current!, {
                language: "circom",
                theme: "vs",

                automaticLayout: true, // the important part
                hover: {
                    enabled: true,
                },
            })

            const modelsToFiles = (models: monaco.editor.ITextModel[]) => {
                return models.map(x => {return {value: x.getValue(), name: x.uri.path.slice(1)}})
            }

            const run = () => {
                if (!workerRef.current || workerRef.current!.running) {
                    if (workerRef.current) {
                        workerRef.current.terminate()
                        workerRef.current = null
                    }
                    workerRef.current = new CircomWorker()
                    circomWorker = workerRef.current
                    workerRef.current.onmessage = (e: MessageEvent) => {
                        const data = e.data
                        if (data.type === "fail") {
                            setRunning(false)
                            workerRef.current!.running = false
                        } else if (data.type === "done") {
                            setRunning(false)
                            workerRef.current!.running = false
                        } else if (data.type === "keys") {
                            setRunning(false)
                            workerRef.current!.running = false
                        } else if (data.type === "hover") {
                            return replyHover(data)
                        } else if (data.type === "debug") {
                            console.log(data.text)
                        } else if (data.type === "progress") {
                            setProgress(data.fraction)
                            return
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
                setRunning(Math.random() + 1)
                setMessages([])
                workerRef.current.postMessage({
                    type: "run",
                    files: modelsToFiles(modelsRef.current),
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
                if (history.state === JSON.stringify(modelsToFiles(modelsRef.current))) {
                    // do nothing!
                    console.log("Already saved!")
                } else if (localStorage.GithubAccessToken) {
                    setRunning(Math.random() + 1)

                    const filesObj: Record<string, { content: string }> = {}
                    for (const model of modelsToFiles(modelsRef.current)) {
                        filesObj[model.name] = {
                            content: model.value
                        }
                    }
                    if (GistID) {
                        filesObj["about_zkrepl.md"] = {
                            content:
                                `Open this in [zkREPL →](https://zkrepl.dev/?gist=${GistID})\n\n` +
                                'This file can be included into other zkREPLs with ```include "gist:' +
                                GistID +
                                '";```',
                        }
                    }
                    fetch(
                        GistID
                            ? "https://api.github.com/gists/" + GistID
                            : "https://api.github.com/gists",
                        {
                            method: "POST",
                            body: JSON.stringify({
                                files: filesObj,
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
                                history.replaceState(JSON.stringify(modelsRef.current), "", "/?gist=" + k.id)

                                setMessages((m) => [
                                    ...m,
                                    {
                                        type: "save",
                                        url: `https://gist.github.com/${k.id}`,
                                        text: `Saved to Github`,
                                    },
                                ])
                            } else if (k.message === "Bad credentials") {
                                logIn()
                            } else if (k.message === "Not Found" && GistID) {
                                // maybe trying to save to something that we don't own
                                // we should then just "fork" it
                                history.replaceState(null, "", "/")
                                save()
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
                    setMessages((k) => [
                        ...k,
                        {
                            type: "abort",
                            text: "Execution manually interrupted",
                        },
                    ])
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

    const switchEditor = (file: monaco.editor.ITextModel) => {
        const saveState = editor?.saveViewState()
        if (saveState && editor?.getModel()) {
            editorState[editor?.getModel()!.uri.path] = saveState
        }

        editor?.setModel(file)
        if (editorState[file.uri.path]) {
            editor?.restoreViewState(editorState[file.uri.path])
        }
    }

    return (
        <div className="layout">
            <div className="sidebar">
                <div className="label">FILES:</div>
                <div className="files">
                    {modelsRef.current.map((file) => {
                        return <li className="file" key={file.uri.path} onClick={() => switchEditor(file)}>{file.uri.path.slice(1)}</li>
                    })}
                </div>
            </div>
            <div className="editor" ref={monacoEl}></div>
            <div className="sidebar">
                <div className="output">
                    <div className="heading">
                        <div className="description">
                            <b>Shift-Enter</b> to run <br />
                            <b>Cmd-S</b> to save as{" "}
                            {GistID ? (
                                <a
                                    href={`https://gist.github.com/${GistID}`}
                                    target="_blank"
                                >
                                    Github Gist
                                </a>
                            ) : (
                                "Github Gist"
                            )}
                        </div>
                        <img
                            className="logo"
                            src={new URL(
                                "./data/logo.png",
                                import.meta.url
                            ).toString()}
                            alt="zkrepl"
                        />
                    </div>
                    <br />
                    {messages.map((m, i) => (
                        <div key={i} className="message">
                            <div className="label">{m.type}: </div>

                            {m.url ? (
                                <a href={m.url}>
                                    <Ansi>{m.text}</Ansi>
                                </a>
                            ) : (
                                <Ansi>{m.text}</Ansi>
                            )}
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
                    {messages.some((k) => k.type === "done") &&
                        !messages.some((k) => k.type === "keys") &&
                        !running &&
                        workerRef.current && (
                            <div>
                                <div className="label">Prove/Verify Keys: </div>
                                <div className="phase2">
                                    <button
                                        onClick={() => {
                                            workerRef.current!.postMessage({
                                                type: "groth16",
                                                // code: editor.getValue(),
                                            })
                                            setRunning(Math.random())
                                        }}
                                    >
                                        Groth16
                                    </button>
                                    <button
                                        onClick={() => {
                                            workerRef.current!.postMessage({
                                                type: "plonk",
                                                // code: editor.getValue(),
                                            })
                                            setRunning(Math.random())
                                        }}
                                    >
                                        PLONK
                                    </button>
                                </div>
                            </div>
                        )}
                    {progress !== 1 && (
                        <div className="progress-container">
                            <progress value={progress} />
                        </div>
                    )}
                    {running ? <LoadingIndicator key={running} /> : null}
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
            {time > 200 && (
                <div className="time">{(time / 1000).toFixed(2)}s</div>
            )}
        </div>
    )
}

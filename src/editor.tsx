import Ansi from "ansi-to-react"
// this is a workaround for what seems to be some kind of bug around
// importing raw urls from webworkers in production builds
import wasmURL from "circom2/circom.wasm?url"
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
import * as monaco from "monaco-editor/esm/vs/editor/editor.api"
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
import { initVimMode } from "monaco-vim"
import React from "react"
import circomLib from "./data/circomlib.zip?url"
import codeExample from "./data/example.circom?raw"
// import 'monaco-editor/esm/vs/editor/standalone/browser/inspectTokens/inspectTokens.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/referenceSearch/standaloneReferenceSearch.js';
// import 'monaco-editor/esm/vs/editor/standalone/browser/toggleHighContrast/toggleHighContrast.js';
import "./syntax"
import { replyHover } from "./syntax"
import CircomWorker from "./worker/worker?worker"

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
    const modelsRef = React.useRef<monaco.editor.ITextModel[]>([])
    const monacoEl = React.useRef(null)
    const workerRef = React.useRef<(Worker & { running?: boolean }) | null>(
        null
    )
    const [progress, setProgress] = React.useState(1)
    const editorState = React.useRef<
        Record<string, monaco.editor.ICodeEditorViewState>
    >({})
    const GistID = new URLSearchParams(location.search).get("gist")

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
                } else if (data.type === "verified") {
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

    const modelsToFiles = (models: monaco.editor.ITextModel[]) => {
        return models.map((x) => {
            return {
                value: x.getValue(),
                name: x.uri.path.slice(1),
                active: x.isAttachedToEditor(),
            }
        })
    }

    const load = (editor: monaco.editor.IStandaloneCodeEditor, data: any) => {
        const tmpModels: monaco.editor.ITextModel[] = []
        for (const key in data?.files) {
            if (key === "about_zkrepl.md") continue
            const model = monaco.editor.createModel(
                data?.files[key].content || "// Unable to load gist",
                "circom",
                new monaco.Uri().with({ path: key })
            )
            tmpModels.push(model)
        }
        modelsRef.current = tmpModels
        editor.setModel(tmpModels[0])
    }
    const exportJSON = () => {
        const filesObj: Record<string, { content: string }> = {}
        for (const model of modelsToFiles(modelsRef.current)) {
            filesObj[model.name] = {
                content: model.value,
            }
        }
        return {
            files: filesObj,
        }
    }
    const save = () => {
        const GistID = new URLSearchParams(location.search).get("gist")
        const logIn = () => {
            localStorage.GithubNavigationCodeSnapshot = JSON.stringify(
                exportJSON()
            )
            location.href =
                "https://github.com/login/oauth/authorize?client_id=85123c5a3a8a8f73f015&scope=gist"
        }
        if (history.state === JSON.stringify(exportJSON())) {
            // do nothing!
            console.log("Already saved!")
        } else if (localStorage.GithubAccessToken) {
            setRunning(Math.random() + 1)

            const saveFile = async (id: null | string) => {
                const filesObj = exportJSON()
                if (id) {
                    filesObj.files["about_zkrepl.md"] = {
                        content:
                            `Open this in [zkREPL →](https://zkrepl.dev/?gist=${id})\n\n` +
                            'This file can be included into other zkREPLs with ```include "gist:' +
                            id +
                            '";```',
                    }
                }
                return fetch(
                    id
                        ? "https://api.github.com/gists/" + id
                        : "https://api.github.com/gists",
                    {
                        method: "POST",
                        body: JSON.stringify(filesObj),
                        headers: {
                            Authorization:
                                "token " + localStorage.GithubAccessToken,
                        },
                    }
                ).then((k) => k.json())
            }

            saveFile(GistID)
                .then((k) => {
                    if (k.id && !GistID) {
                        return saveFile(k.id)
                    } else {
                        return k
                    }
                })
                .then((k) => {
                    if (k.id) {
                        history.replaceState(
                            JSON.stringify(exportJSON()),
                            "",
                            "/?gist=" + k.id
                        )

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
    React.useEffect(() => {
        if (monacoEl && !editor) {
            const editor = monaco.editor.create(monacoEl.current!, {
                language: "circom",
                theme: "vs",

                automaticLayout: true, // the important part
                hover: {
                    enabled: true,
                },
            })

            initVimMode(editor, document.getElementsByClassName("statusbar")[0])

            window.addEventListener("beforeunload", () => {
                sessionStorage.ZKReplState = JSON.stringify(exportJSON())
            })

            window.addEventListener("keydown", (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "r") {
                    e.preventDefault()
                }
            })

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
                            load(
                                editor,
                                JSON.parse(
                                    localStorage.GithubNavigationCodeSnapshot
                                )
                            )
                            save()
                        } else {
                            alert("Failed to get access token")
                        }
                    })
            } else if (sessionStorage.ZKReplState) {
                load(editor, JSON.parse(sessionStorage.ZKReplState))
                delete sessionStorage.ZKReplState
                run()
            } else if (GistID) {
                fetch("https://api.github.com/gists/" + GistID)
                    .then((data) => data.json())
                    .then((data) => {
                        load(editor, data)
                        run()
                    })
            } else {
                load(editor, {
                    files: {
                        "main.circom": { content: codeExample },
                    },
                })
                run()
            }
            setEditor(editor)
        }

        return () => editor?.dispose()
    }, [monacoEl.current])

    const switchEditor = (file: monaco.editor.ITextModel) => {
        const saveState = editor?.saveViewState()
        if (saveState && editor?.getModel()) {
            editorState.current[editor?.getModel()!.uri.path] = saveState
        }

        editor?.setModel(file)
        if (editorState.current[file.uri.path]) {
            editor?.restoreViewState(editorState.current[file.uri.path])
        }
        setMessages((k) => k.slice(0))
    }

    return (
        <div className="layout">
            <div className="primary">
                <div className="tabs">
                    {modelsRef.current.map((file, modelIndex) => {
                        const deleteFile = (e: React.MouseEvent) => {
                            if (
                                (file?.getValue()?.length || 0) < 30 ||
                                file?.getValue() === codeExample ||
                                confirm(
                                    `Are you sure you want to remove "${file.uri.path.slice(
                                        1
                                    )}"?`
                                )
                            ) {
                                file.dispose()

                                if (modelsRef.current.length == 1) {
                                    const model = monaco.editor.createModel(
                                        codeExample,
                                        "circom",
                                        new monaco.Uri().with({
                                            path: "main.circom",
                                        })
                                    )
                                    modelsRef.current.push(model)
                                    editor!.setModel(model)
                                }

                                modelsRef.current.splice(modelIndex, 1)
                                editor?.setModel(modelsRef.current[0])
                                setMessages((k) => k.slice(0))
                                e.stopPropagation()
                            }
                        }

                        return (
                            <div
                                className={
                                    "tab " +
                                    (editor?.getModel()!.uri.path ===
                                    file.uri.path
                                        ? "active"
                                        : "inactive")
                                }
                                onClick={(e) => {
                                    switchEditor(file)
                                }}
                                onMouseUp={(e) => {
                                    if (e.button == 1) {
                                        deleteFile(e)
                                    }
                                }}
                                key={modelIndex}
                            >
                                <input
                                    value={file.uri.path.slice(1)}
                                    spellCheck={false}
                                    onChange={(e) => {
                                        const fileName = e.target.value
                                        const fileExists =
                                            modelsRef.current.some(
                                                (k) =>
                                                    k.uri.path ===
                                                    "/" + fileName
                                            )
                                        if (!fileExists) {
                                            const model =
                                                monaco.editor.createModel(
                                                    file.getValue(),
                                                    "circom",
                                                    new monaco.Uri().with({
                                                        path: fileName,
                                                    })
                                                )
                                            file.dispose()
                                            modelsRef.current.splice(
                                                modelIndex,
                                                1,
                                                model
                                            )
                                            editor?.setModel(model)
                                        }
                                        e.target.style.width = "0px"
                                        e.target.style.width =
                                            e.target.scrollWidth + 2 + "px"

                                        setMessages((k) => k.slice(0))
                                    }}
                                    ref={(e) => {
                                        if (e) {
                                            e.style.width = "0px"
                                            e.style.width =
                                                e.scrollWidth + 2 + "px"
                                        }
                                    }}
                                />

                                <div className="x" onClick={deleteFile}>
                                    <div>×</div>
                                </div>
                            </div>
                        )
                    })}

                    <div
                        className="add"
                        onClick={() => {
                            let fileName = "untitled.circom"
                            for (
                                let i = 2;
                                modelsRef.current.some(
                                    (k) => k.uri.path == "/" + fileName
                                );
                                i++
                            ) {
                                fileName = `untitled${i}.circom`
                            }
                            const model = monaco.editor.createModel(
                                codeExample,
                                "circom",
                                new monaco.Uri().with({
                                    path: fileName,
                                })
                            )
                            modelsRef.current.push(model)
                            editor!.setModel(model)
                            // trigger a re-render of this react component
                            setMessages(messages.slice(0))
                        }}
                    >
                        + Add File
                    </div>
                </div>

                <div className="editor" ref={monacoEl}></div>

                <div className="statusbar"></div>
            </div>
            <div className="sidebar">
                <div className="output">
                    <div className="heading">
                        <div className="description">
                            <b>Shift-Enter</b> to{" "}
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault()
                                    run()
                                }}
                            >
                                run
                            </a>{" "}
                            <br />
                            <b>Cmd-S</b> to{" "}
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault()
                                    save()
                                }}
                            >
                                save
                            </a>{" "}
                            as{" "}
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
                            {m.type === "keys" && (
                                <div className="insecure">
                                    WARNING: These keys are strictly for testing
                                    purposes, and are generated insecurely!
                                </div>
                            )}
                            {m.url ? (
                                <a href={m.url}>
                                    <Ansi>{m.text}</Ansi>
                                </a>
                            ) : (
                                <Ansi>{m.text}</Ansi>
                            )}
                            {m.type === "save" && (
                                <div className="embed-snippet">
                                    <textarea
                                        readOnly
                                        onClick={(e) => {
                                            ;(
                                                e.target as HTMLTextAreaElement
                                            ).select()
                                            document.execCommand("copy")
                                        }}
                                        value={`<iframe src="https://zkrepl.dev/?gist=${GistID}" height="400" width="1000" style="border:1px solid #ddd"></iframe>`}
                                    />
                                </div>
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
                    {
                        // messages.some((k) => k.type === "done") &&
                        //     !messages.some((k) => k.type === "keys") &&
                        //     !messages.some((k) => k.type === "verified") &&
                        !running && workerRef.current && (
                            <div>
                                <div className="label">Keys: </div>
                                <div className="phase2">
                                    <input
                                        type="file"
                                        id="zkey_upload"
                                        accept=".zkey"
                                        className="hidden-file"
                                        onChange={(e) => {
                                            const file = e.target?.files?.[0]
                                            if (file) {
                                                const reader = new FileReader()
                                                reader.onload = () => {
                                                    workerRef.current!.postMessage(
                                                        {
                                                            type: "verify",
                                                            data: reader.result,
                                                        }
                                                    )
                                                    setRunning(Math.random())
                                                }
                                                reader.readAsArrayBuffer(file)
                                            }
                                        }}
                                    ></input>

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
                                    <button
                                        onClick={() => {
                                            document
                                                .getElementById("zkey_upload")!
                                                .click()
                                        }}
                                    >
                                        Verify
                                    </button>
                                </div>
                            </div>
                        )
                    }
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
            <div className="time">
                <small>
                    <b>Cmd-.</b> to interrupt
                </small>
            </div>
        </div>
    )
}

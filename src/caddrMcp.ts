import * as monaco from "monaco-editor/esm/vs/editor/editor.api"

const CADDR_MCP_API_URL = "https://caddr-origin.github.io/examples/mcp/api.js"
const ZKREPL_MCP_VERSION = "1.0.0"

type CaddrSender = {
    from?: string
    fromOrigin?: string
}

type CaddrTool = {
    name: string
    description: string
    input_schema: Record<string, unknown>
    execute(sender: CaddrSender, params?: Record<string, unknown>): unknown
}

type CaddrServerInfo = {
    insertFrame(frame: HTMLElement): void
    showAuthorizationFrame(): void
    hideAuthorizationFrame(): void
    name: string
    version: string
    tools: CaddrTool[]
}

type RegisterMCPServer = (info: CaddrServerInfo) => Promise<void> | void

declare global {
    interface Window {
        registerMCPServer?: RegisterMCPServer
        __zkReplCaddrMCPScriptPromise?: Promise<RegisterMCPServer>
    }
}

export type CaddrMCPStatusState =
    | "idle"
    | "connecting"
    | "authorization"
    | "connected"
    | "error"

export type CaddrMCPStatus = {
    state: CaddrMCPStatusState
    label: string
    error?: string
}

export type ZkReplMCPMessage = {
    type: string
    text: string
    files?: Record<string, Uint8Array>
    url?: string
}

export type ZkReplMCPOptions = {
    getEditor(): monaco.editor.IStandaloneCodeEditor | null
    getModels(): monaco.editor.ITextModel[]
    getMessages(): ZkReplMCPMessage[]
    isRunning(): boolean
    refresh(): void
    run(): void
    save(): void
    setStatus?(status: CaddrMCPStatus): void
}

type AuthorizationFrame = {
    modal: HTMLDivElement
    content: HTMLDivElement
}

let registrationPromise: Promise<void> | undefined
let authorizationFrame: AuthorizationFrame | undefined
let statusListener: ((status: CaddrMCPStatus) => void) | undefined

export const initialCaddrMCPStatus: CaddrMCPStatus = {
    state: "idle",
    label: "caddr offline",
}

export function isCaddrMCPEnabled(search = location.search) {
    return new URLSearchParams(search).has("caddr")
}

export function registerZkReplMCP(options: ZkReplMCPOptions) {
    if (typeof window === "undefined" || !isCaddrMCPEnabled()) {
        return
    }
    statusListener = options.setStatus

    if (registrationPromise) {
        return registrationPromise
    }

    setCaddrMCPStatus("connecting")
    registrationPromise = loadCaddrMCP()
        .then((registerMCPServer) => {
            authorizationFrame = createAuthorizationFrame()
            const tools = createZkReplTools(options)

            return registerMCPServer({
                insertFrame: (frame) => {
                    frame.style.width = "100%"
                    frame.style.height = "80px"
                    frame.style.border = "0"
                    authorizationFrame!.content.appendChild(frame)
                },
                showAuthorizationFrame: () => {
                    setCaddrMCPStatus("authorization")
                    authorizationFrame!.modal.style.display = "flex"
                },
                hideAuthorizationFrame: () => {
                    setCaddrMCPStatus("connected")
                    authorizationFrame!.modal.style.display = "none"
                },
                name: "zkREPL",
                version: ZKREPL_MCP_VERSION,
                tools,
            })
        })
        .then(() => undefined)
        .catch((error) => {
            registrationPromise = undefined
            setCaddrMCPStatus("error", getErrorMessage(error))
            console.warn("[caddr-mcp] Failed to register zkREPL MCP server:", error)
        })

    return registrationPromise
}

export function showZkReplMCPAuthorization() {
    authorizationFrame ??= createAuthorizationFrame()
    authorizationFrame.modal.style.display = "flex"
    setCaddrMCPStatus("authorization")
}

function setCaddrMCPStatus(state: CaddrMCPStatusState, error?: string) {
    const labels: Record<CaddrMCPStatusState, string> = {
        idle: "caddr offline",
        connecting: "caddr connecting",
        authorization: "caddr authorize",
        connected: "caddr connected",
        error: "caddr error",
    }

    statusListener?.({
        state,
        label: labels[state],
        error,
    })
}

function loadCaddrMCP() {
    if (typeof window.registerMCPServer === "function") {
        return Promise.resolve(window.registerMCPServer)
    }

    window.__zkReplCaddrMCPScriptPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = CADDR_MCP_API_URL
        script.async = true
        script.onload = () => {
            if (typeof window.registerMCPServer === "function") {
                resolve(window.registerMCPServer)
            } else {
                reject(new Error("Caddr-MCP API loaded without registerMCPServer"))
            }
        }
        script.onerror = () =>
            reject(new Error(`Could not load ${CADDR_MCP_API_URL}`))
        document.head.appendChild(script)
    })

    return window.__zkReplCaddrMCPScriptPromise
}

function createAuthorizationFrame(): AuthorizationFrame {
    const existing = document.getElementById("zkrepl-caddr-authorization")
    if (existing) {
        return {
            modal: existing as HTMLDivElement,
            content: existing.querySelector(
                "[data-caddr-frame-container]"
            ) as HTMLDivElement,
        }
    }

    const modal = document.createElement("div")
    modal.id = "zkrepl-caddr-authorization"
    Object.assign(modal.style, {
        alignItems: "center",
        background: "rgba(0, 0, 0, 0.45)",
        bottom: "0",
        display: "none",
        justifyContent: "center",
        left: "0",
        padding: "16px",
        position: "fixed",
        right: "0",
        top: "0",
        zIndex: "9999",
    })

    const dialog = document.createElement("div")
    Object.assign(dialog.style, {
        background: "#202030",
        border: "1px solid #555575",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "460px",
        padding: "20px",
        width: "100%",
    })

    const title = document.createElement("h2")
    title.textContent = "Authorize Caddr-MCP"
    Object.assign(title.style, {
        fontSize: "18px",
        fontWeight: "600",
        margin: "0 0 8px",
    })

    const description = document.createElement("p")
    description.textContent =
        "Authorize this Caddr-MCP client to control zkREPL."
    Object.assign(description.style, {
        fontSize: "14px",
        lineHeight: "1.4",
        margin: "0 0 16px",
    })

    const content = document.createElement("div")
    content.setAttribute("data-caddr-frame-container", "")

    dialog.append(title, description, content)
    modal.appendChild(dialog)
    document.body.appendChild(modal)

    return { modal, content }
}

function createZkReplTools(options: ZkReplMCPOptions): CaddrTool[] {
    return [
        {
            name: "get_source_code",
            description: "Get the source code from the active zkREPL file.",
            input_schema: emptyObjectSchema(),
            execute(sender) {
                void sender
                const model = getActiveModel(options)
                return model?.getValue() ?? ""
            },
        },
        {
            name: "set_source_code",
            description:
                "Replace the source code in the active zkREPL file, or in file_name when provided.",
            input_schema: {
                type: "object",
                properties: {
                    source: {
                        type: "string",
                        description: "The complete Circom source code.",
                    },
                    file_name: {
                        type: "string",
                        description:
                            "Optional zkREPL file name to update. Defaults to the active file.",
                    },
                    active: {
                        type: "boolean",
                        description:
                            "Whether to switch the editor to the updated file. Defaults to true.",
                    },
                },
                required: ["source"],
            },
            execute(sender, params = {}) {
                void sender
                return setSourceCode(options, params)
            },
        },
        {
            name: "replace_source_range",
            description:
                "Replace a range of source code using zero-based character offsets.",
            input_schema: {
                type: "object",
                properties: {
                    from: {
                        type: "number",
                        description: "Start character offset, inclusive.",
                    },
                    to: {
                        type: "number",
                        description: "End character offset, exclusive.",
                    },
                    insert: {
                        type: "string",
                        description: "Text to insert in place of the range.",
                    },
                    file_name: {
                        type: "string",
                        description:
                            "Optional zkREPL file name. Defaults to the active file.",
                    },
                },
                required: ["from", "to", "insert"],
            },
            execute(sender, params = {}) {
                void sender
                return replaceSourceRange(options, params)
            },
        },
        {
            name: "list_files",
            description: "List files currently open in zkREPL.",
            input_schema: emptyObjectSchema(),
            execute(sender) {
                void sender
                return {
                    files: listFiles(options),
                }
            },
        },
        {
            name: "get_file",
            description: "Get one zkREPL file by name, or the active file.",
            input_schema: {
                type: "object",
                properties: {
                    file_name: {
                        type: "string",
                        description:
                            "Optional zkREPL file name. Defaults to the active file.",
                    },
                },
                required: [],
            },
            execute(sender, params = {}) {
                void sender
                const model = getModelByOptionalName(options, params.file_name)
                if (!model) {
                    return { success: false, error: "File not found." }
                }
                return modelToFileWithContent(model, options)
            },
        },
        {
            name: "set_file",
            description: "Create or replace a zkREPL file.",
            input_schema: {
                type: "object",
                properties: {
                    file_name: {
                        type: "string",
                        description: "The zkREPL file name to create or update.",
                    },
                    source: {
                        type: "string",
                        description: "The complete file contents.",
                    },
                    active: {
                        type: "boolean",
                        description:
                            "Whether to switch the editor to this file. Defaults to true.",
                    },
                },
                required: ["file_name", "source"],
            },
            execute(sender, params = {}) {
                void sender
                return setFile(options, params)
            },
        },
        {
            name: "get_project",
            description: "Get all source files currently open in zkREPL.",
            input_schema: emptyObjectSchema(),
            execute(sender) {
                void sender
                const activeModel = getActiveModel(options)
                return {
                    active_file: activeModel ? getModelName(activeModel) : null,
                    files: Object.fromEntries(
                        options.getModels().map((model) => [
                            getModelName(model),
                            {
                                content: model.getValue(),
                                active: model === activeModel,
                            },
                        ])
                    ),
                }
            },
        },
        {
            name: "run",
            description: "Run the current zkREPL project.",
            input_schema: emptyObjectSchema(),
            execute(sender) {
                void sender
                options.run()
                return {
                    success: true,
                    requested: "run",
                    files: listFiles(options),
                }
            },
        },
        {
            name: "save_gist",
            description:
                "Save the current zkREPL project as a GitHub Gist. This may redirect for GitHub authorization.",
            input_schema: emptyObjectSchema(),
            execute(sender) {
                void sender
                options.save()
                return {
                    success: true,
                    requested: "save_gist",
                }
            },
        },
        {
            name: "get_output",
            description: "Get current zkREPL output messages and generated file names.",
            input_schema: emptyObjectSchema(),
            execute(sender) {
                void sender
                return {
                    running: options.isRunning(),
                    messages: options.getMessages().map((message) => ({
                        type: message.type,
                        text: message.text,
                        url: message.url,
                        files: message.files
                            ? Object.fromEntries(
                                  Object.entries(message.files).map(
                                      ([name, data]) => [
                                          name,
                                          { byte_length: data.length },
                                      ]
                                  )
                              )
                            : undefined,
                    })),
                }
            },
        },
    ]
}

function setSourceCode(
    options: ZkReplMCPOptions,
    params: Record<string, unknown>
) {
    if (typeof params.source !== "string") {
        return { success: false, error: "source must be a string." }
    }

    const model = getModelByOptionalName(options, params.file_name)
    if (!model && params.file_name !== undefined) {
        return setFile(options, params)
    }
    if (!model) {
        return { success: false, error: "No active file is available." }
    }

    model.setValue(params.source)
    if (params.active !== false) {
        options.getEditor()?.setModel(model)
    }
    options.refresh()

    return {
        success: true,
        code_updated: true,
        file_name: getModelName(model),
    }
}

function replaceSourceRange(
    options: ZkReplMCPOptions,
    params: Record<string, unknown>
) {
    const model = getModelByOptionalName(options, params.file_name)
    if (!model) {
        return { success: false, error: "File not found." }
    }
    if (
        typeof params.from !== "number" ||
        typeof params.to !== "number" ||
        typeof params.insert !== "string"
    ) {
        return {
            success: false,
            error: "from and to must be numbers, and insert must be a string.",
        }
    }

    const source = model.getValue()
    const from = Math.max(0, Math.min(source.length, Math.floor(params.from)))
    const to = Math.max(from, Math.min(source.length, Math.floor(params.to)))
    model.setValue(source.slice(0, from) + params.insert + source.slice(to))
    options.refresh()

    return {
        success: true,
        code_updated: true,
        file_name: getModelName(model),
        from,
        to,
    }
}

function setFile(options: ZkReplMCPOptions, params: Record<string, unknown>) {
    const fileName = normalizeFileName(params.file_name)
    if (!fileName) {
        return { success: false, error: "file_name must be a non-empty string." }
    }
    if (typeof params.source !== "string") {
        return { success: false, error: "source must be a string." }
    }

    let model = findModel(options.getModels(), fileName)
    const created = !model
    if (model) {
        model.setValue(params.source)
    } else {
        model = monaco.editor.createModel(
            params.source,
            "circom",
            new monaco.Uri().with({ path: fileName })
        )
        options.getModels().push(model)
    }

    if (params.active !== false) {
        options.getEditor()?.setModel(model)
    }
    options.refresh()

    return {
        success: true,
        created,
        code_updated: true,
        file_name: getModelName(model),
    }
}

function getModelByOptionalName(
    options: ZkReplMCPOptions,
    fileName: unknown
) {
    const normalized = normalizeFileName(fileName)
    if (!normalized) {
        return getActiveModel(options)
    }
    return findModel(options.getModels(), normalized)
}

function getActiveModel(options: ZkReplMCPOptions) {
    return options.getEditor()?.getModel() ?? options.getModels()[0] ?? null
}

function findModel(models: monaco.editor.ITextModel[], fileName: string) {
    return models.find((model) => getModelName(model) === fileName)
}

function listFiles(options: ZkReplMCPOptions) {
    return options.getModels().map((model) => modelToFile(model, options))
}

function modelToFile(
    model: monaco.editor.ITextModel,
    options: ZkReplMCPOptions
) {
    return {
        name: getModelName(model),
        active: model === getActiveModel(options),
        length: model.getValueLength(),
        language: model.getLanguageId(),
    }
}

function modelToFileWithContent(
    model: monaco.editor.ITextModel,
    options: ZkReplMCPOptions
) {
    return {
        ...modelToFile(model, options),
        content: model.getValue(),
    }
}

function getModelName(model: monaco.editor.ITextModel) {
    return model.uri.path.replace(/^\/+/, "")
}

function normalizeFileName(fileName: unknown) {
    if (typeof fileName !== "string") {
        return null
    }
    const normalized = fileName.trim().replace(/^\/+/, "")
    return normalized || null
}

function emptyObjectSchema() {
    return {
        type: "object",
        properties: {},
        required: [],
    }
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

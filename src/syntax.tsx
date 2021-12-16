import * as monaco from "monaco-editor/esm/vs/editor/editor.api"
import { circomWorker } from "./editor"
monaco.languages.register({ id: "circom" })

export let replyHover = (data: any) => {}

monaco.languages.registerHoverProvider("circom", {
    provideHover: async function (model, position) {
        if ((circomWorker as any).running) return null

        const haystack = model.getLineContent(position.lineNumber)
        const signalMatcher =
            /([a-z$_][a-z0-9$_]*)(\.[a-z$_][a-z0-9$_]*)*(\[\d+\])?/g
        const cursor = position.column
        let m: RegExpExecArray | null

        m = /(include\s+)"([^"]+)"/g.exec(haystack)
        if (m) {
            let contents = []

            if (m[2].startsWith("circomlib/")) {
                contents.push({
                    value: `[View Source](https://github.com/iden3/circomlib/blob/master/circuits/${m[2].replace(
                        "circomlib/",
                        ""
                    )})`,
                })
            } else if (m[2].startsWith("gist:")) {
                contents.push({
                    value: `[View Source](https://gist.github.com/${m[2].replace(
                        "gist:",
                        ""
                    )})`,
                })
            }
            return {
                range: new monaco.Range(
                    position.lineNumber,
                    1 + m.index + m[1].length,
                    position.lineNumber,
                    1 + m.index + m[0].length
                ),
                contents: contents,
            }
        }

        while ((m = signalMatcher.exec(haystack))) {
            if (m.index > cursor) break
            if (m.index + m[0].length < cursor) continue
            const symbol = m[0]
            const result: string = await new Promise((resolve) => {
                replyHover = (data: any) => {
                    resolve(data.text)
                    replyHover = () => {}
                }
                circomWorker.postMessage({
                    type: "hover",
                    symbol: symbol,
                })
            })
            return {
                range: new monaco.Range(
                    position.lineNumber,
                    1 + m.index,
                    position.lineNumber,
                    1 + m.index + m[0].length
                ),
                contents: [{ value: result }],
            }
        }

        return null
    },
})

monaco.languages.setLanguageConfiguration("circom", {
    wordPattern:
        /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,

    comments: {
        lineComment: "//",
        blockComment: ["/*", "*/"],
    },

    brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
    ],

    onEnterRules: [
        {
            // e.g. /** | */
            beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
            afterText: /^\s*\*\/$/,
            action: {
                indentAction: monaco.languages.IndentAction.IndentOutdent,
                appendText: " * ",
            },
        },
        {
            // e.g. /** ...|
            beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
            action: {
                indentAction: monaco.languages.IndentAction.None,
                appendText: " * ",
            },
        },
        {
            // e.g.  * ...|
            beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
            action: {
                indentAction: monaco.languages.IndentAction.None,
                appendText: "* ",
            },
        },
        {
            // e.g.  */|
            beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
            action: {
                indentAction: monaco.languages.IndentAction.None,
                removeText: 1,
            },
        },
    ],

    autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"', notIn: ["string"] },
        { open: "'", close: "'", notIn: ["string", "comment"] },
        { open: "`", close: "`", notIn: ["string", "comment"] },
        { open: "/**", close: " */", notIn: ["string"] },
    ],

    folding: {
        markers: {
            start: new RegExp("^\\s*//\\s*#?region\\b"),
            end: new RegExp("^\\s*//\\s*#?endregion\\b"),
        },
    },
})

monaco.languages.setMonarchTokensProvider("circom", {
    keywords: [
        "signal",
        "input",
        "output",
        "public",
        "template",
        "component",
        "var",
        "function",
        "return",
        "if",
        "else",
        "for",
        "while",
        "do",
        "log",
        "assert",
        "include",
        "pragma",
    ],

    typeKeywords: ["input", "output", "public"],

    operators: [
        "!",
        "~",
        "-",
        "||",
        "&&",
        "==",
        "!=",
        "<",
        ">",
        "<=",
        ">=",
        "|",
        "&",
        "<<",
        ">>",
        "+",
        "-",
        "*",
        "/",
        "\\",
        "%",
        "**",
        "^",
        "=",
        "<--",
        "<==",
    ],

    // we include these common regular expressions
    // symbols:  /[=><!~?:&|+\-*\/\^%]+/,

    // C# style strings
    escapes:
        /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages

    tokenizer: {
        root: [
            // identifiers and keywords
            [
                /[a-z_$][\w$]*/,
                {
                    cases: {
                        "@typeKeywords": "keyword",
                        "@keywords": "keyword",
                        "@default": "identifier",
                    },
                },
            ],
            [/[A-Z][\w\$]*/, "type.identifier"], // to show class names nicely

            // whitespace
            { include: "@whitespace" },

            // delimiters and operators
            [/[{}()\[\]]/, "@brackets"],

            // [/[<>](?!@symbols)/, "@brackets"],
            // [
            //     /@symbols/,
            //     { cases: { "@operators": "operator", "@default": "" } },
            // ],

            // @ annotations.
            // As an example, we emit a debugging log message on these tokens.
            // Note: message are supressed during the first load -- change some lines to see them.
            [
                /@\s*[a-zA-Z_\$][\w\$]*/,
                { token: "annotation", log: "annotation token: $0" },
            ],

            // numbers
            [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
            [/0[xX][0-9a-fA-F]+/, "number.hex"],
            [/\d+/, "number"],

            // delimiter: after number because of .\d floats
            [/[;,.]/, "delimiter"],

            // strings
            [/"([^"\\]|\\.)*$/, "string.invalid"], // non-teminated string
            [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

            // characters
            [/'[^\\']'/, "string"],
            [/(')(@escapes)(')/, ["string", "string.escape", "string"]],
            [/'/, "string.invalid"],
        ],

        comment: [
            [/[^\/*]+/, "comment"],
            [/\/\*/, "comment", "@push"], // nested comment
            ["\\*/", "comment", "@pop"],
            [/[\/*]/, "comment"],
        ],

        string: [
            [/[^\\"]+/, "string"],
            [/@escapes/, "string.escape"],
            [/\\./, "string.escape.invalid"],
            [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        ],

        whitespace: [
            [/[ \t\r\n]+/, "white"],
            [/\/\*/, "comment", "@comment"],
            [/\/\/.*$/, "comment"],
        ],
    },
})

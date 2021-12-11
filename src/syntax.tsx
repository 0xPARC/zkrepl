import * as monaco from "monaco-editor/esm/vs/editor/editor.api"
import { circomWorker } from "./editor"
monaco.languages.register({ id: "circom" })

export let replyHover = (data: any) => {}

monaco.languages.registerHoverProvider("circom", {
    provideHover: async function (model, position) {
        if ((circomWorker as any).running) return null

        const haystack = model.getLineContent(position.lineNumber)
        const titleMatcher = /[a-z]+\.[a-z]+(\[\d+\])?/g
        const cursor = position.column
        let m: RegExpExecArray | null
        while ((m = titleMatcher.exec(haystack))) {
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
            // const result = "blah"
            return {
                range: new monaco.Range(
                    position.lineNumber,
                    m.index,
                    position.lineNumber,
                    m.index + m[0].length
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

// Define a new theme that contains only rules that match this language
// monaco.editor.defineTheme("myCoolTheme", {
//     base: "vs",
//     inherit: false,
//     rules: [
//         { token: "custom-info", foreground: "808080" },
//         { token: "custom-error", foreground: "ff0000", fontStyle: "bold" },
//         { token: "custom-notice", foreground: "FFA500" },
//         { token: "custom-date", foreground: "008800" },
//     ],
//     colors: {
//         "editor.foreground": "#000000",
//     },
// })

// Register a completion item provider for the new language
// monaco.languages.registerCompletionItemProvider("circom", {
//     provideCompletionItems: () => {
//         var suggestions = [
//             {
//                 label: "simpleText",
//                 kind: monaco.languages.CompletionItemKind.Text,
//                 insertText: "simpleText",
//             },
//             {
//                 label: "testing",
//                 kind: monaco.languages.CompletionItemKind.Keyword,
//                 insertText: "testing(${1:condition})",
//                 insertTextRules:
//                     monaco.languages.CompletionItemInsertTextRule
//                         .InsertAsSnippet,
//             },
//             {
//                 label: "ifelse",
//                 kind: monaco.languages.CompletionItemKind.Snippet,
//                 insertText: [
//                     "if (${1:condition}) {",
//                     "\t$0",
//                     "} else {",
//                     "\t",
//                     "}",
//                 ].join("\n"),
//                 insertTextRules:
//                     monaco.languages.CompletionItemInsertTextRule
//                         .InsertAsSnippet,
//                 documentation: "If-Else Statement",
//             },
//         ]
//         return { suggestions: suggestions }
//     },
// })

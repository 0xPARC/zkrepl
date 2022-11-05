import { Buffer } from "buffer-es6"
export default Buffer

// TODO: workaround for "?url" import in worker (cf. https://github.com/vitejs/vite/issues/9879)
if (import.meta.env.PROD && typeof document === "undefined") {
	Object.assign(globalThis, {
		document: {
			currentScript: {
				src: self.location.href,
			},
		},
	})
}

// Object.assign(globalThis, {
// 		process: {
// 			currentScript: {
// 				src: self.location.href,
// 			},
// 		},
// 	})

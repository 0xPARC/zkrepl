import utils from "rollup-plugin-node-polyfills/polyfills/util"

console.log("UTIL IMPORT AGAIN")

export default utils

const TextEncoder_ = TextEncoder
const TextDecoder_ = TextDecoder
export { TextEncoder_ as TextEncoder, TextDecoder_ as TextDecoder }

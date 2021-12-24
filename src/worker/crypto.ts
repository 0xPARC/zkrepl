export function randomBytes(numBytes: number) {
    return crypto.getRandomValues(new Uint8Array(numBytes))
}

export default { randomBytes }

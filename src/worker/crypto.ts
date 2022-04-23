export function randomBytes(numBytes: number) {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(numBytes)))
}

export function randomFillSync(buffer: Uint8Array) {
    return crypto.getRandomValues(buffer)
}

export default { randomBytes, randomFillSync }

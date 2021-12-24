declare module "circom2/vendor/wasi" {
    export * from "@wasmer/wasi"
}

declare module "snarkjs" {
    export const zKey: {
        newZKey(
            r1csName: any,
            ptauName: any,
            zkeyName: any,
            logger?: any
        ): Promise<any>
    }
}

declare module "buffer-es6" {
    export * from "buffer"
}

declare module "@iden3/binfileutils" {
    export function readBinFile(
        fileName: any,
        type: string,
        maxVersion: number,
        cacheSize: number,
        pageSize: number
    ): Promise<{ fd: any; sections: any[] }>

    export function readSection(
        fd: any,
        sections: any[],
        idSection: number,
        offset?: number,
        length?: number
    ): Promise<any>

    export function startReadUniqueSection(
        fd: any,
        sections: any[],
        idSection: number,
        offset?: number,
        length?: number
    ): Promise<any>

    export function readBigInt(
        fd: any,
        offset: number,
        length?: number
    ): Promise<bigint>

    export function endReadSection(fd: any): Promise<void>
}

declare module "r1csfile" {
    type R1CSHeader = {
        curve: any
        n8: number
        nConstraints: number
        nLabels: number
        nOutputs: number
        nPrvInputs: number
        nPubInputs: number
        nVars: number
        prime: bigint
    }

    export function readR1csHeader(
        fd: any,
        sections: any[],
        singleThread: boolean
    ): Promise<R1CSHeader>
}

declare module "ffjavascript" {
    export const Scalar: any
}

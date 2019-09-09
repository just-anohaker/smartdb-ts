import { Entity } from "./Common";

export interface BlockHeader extends Entity {
    height: number,
    id?: string,
    timestamp?: number,
    payloadLength?: number,
    payloadHash?: string,
    prevBlockId?: string,
    pointId?: string,
    pointHeight?: number,
    delegate?: string,
    signature?: string,
    count?: number
}

export type BigNumber = number;

export interface Transaction extends Entity {
    id: string,
    blockId: string,
    type: number,
    timestamp: number,
    senderPublicKey: Buffer,
    senderId: string,
    recipientId: string,
    amount: BigNumber,
    fee: BigNumber,
    signature?: Buffer,
    signSignature?: Buffer,
    signatures?: string,
    args?: string,
    message?: string
}

export interface Block extends BlockHeader {
    transactions?: Transaction[]
}
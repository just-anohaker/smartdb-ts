import { BlockHeader, Block } from "./Block";
import { ChangesHistoryItem } from "./tracker/EntityTracker";
import { Entity, MaybeUndefined } from "./Common";
export declare class LevelBlock {
    private db;
    private blockDb?;
    private historyDb?;
    private lastHeight;
    constructor(dir: string, levelOptions?: {});
    open(): Promise<void>;
    close(): Promise<void>;
    readonly lastBlockHeight: number;
    appendBlock(block: BlockHeader, changes: ChangesHistoryItem<Entity>[]): Promise<void>;
    getBlock(height: number): Promise<MaybeUndefined<Block>>;
    getHistoryChanges(minHeight: number, maxHeight: number): Promise<Map<number, Array<ChangesHistoryItem<Entity>>>>;
    deleteLastBlock(height: number): Promise<void>;
    getBlockById(blockId: string): Promise<MaybeUndefined<BlockHeader>>;
    getBlocksByHeightRange(minHeight: number, maxHeight: number): Promise<BlockHeader[]>;
    getBlocksByIds(blockIds: string[]): Promise<BlockHeader[]>;
    private getLastHeightJson;
    private getLastBlockHeightFromDb;
    private isKeyNotFoundError;
}

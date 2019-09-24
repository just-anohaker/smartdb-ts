import { BlockHeader, Block } from "./Block";
import { ChangesHistoryItem } from "./tracker/EntityTracker";
import { Entity, MaybeUndefined } from "./Common";
import { SubLevelMeta, LevelDB, IndexedLevel, } from "./kvdb/LevelDB";

const keyLastBlockHeight = "__last_block_height__";

export class LevelBlock {
    private db: LevelDB;
    private blockDb?: IndexedLevel;
    private historyDb?: IndexedLevel;
    private lastHeight: number;
    constructor(dir: string, levelOptions: {} = {}) {
        const blkSubLevelMeta = new SubLevelMeta("blk", "height", [
            { fieldName: "id" },
            { fieldName: "delegate" }
        ]);
        const hisSubLevelMeta = new SubLevelMeta("his", "height", []);
        this.db = new LevelDB(dir, [blkSubLevelMeta, hisSubLevelMeta], levelOptions);
        this.lastHeight = -1;
    }

    async open(): Promise<void> {
        await this.db.open();
        this.blockDb = this.db.getSubLevel("blk");
        this.historyDb = this.db.getSubLevel("his");
        this.lastHeight = await this.getLastBlockHeightFromDb();
    }

    async close(): Promise<void> {
        await this.db.close();
    }

    get lastBlockHeight(): number {
        return this.lastHeight;
    }

    async appendBlock(block: BlockHeader, changes: ChangesHistoryItem<Entity>[]): Promise<void> {
        if (!block || !block.id || !block.delegate || block.height === undefined) {
            throw new Error("Invalid block data");
        }
        await this.historyDb!.put(block.height, changes);
        await this.blockDb!.batch([
            {
                type: "put",
                key: block.height,
                value: block
            },
            {
                type: "put",
                key: keyLastBlockHeight,
                value: this.getLastHeightJson(block.height)
            }
        ]);
        this.lastHeight = block.height;
    }

    async getBlock(height: number): Promise<MaybeUndefined<Block>> {
        try {
            return await this.blockDb!.get(height);
        } catch (error) {
            if (!this.isKeyNotFoundError(error)) {
                throw error;
            }
        }
        return undefined;
    }

    async getHistoryChanges(minHeight: number, maxHeight: number): Promise<Map<number, Array<ChangesHistoryItem<Entity>>>> {
        const result: Map<number, ChangesHistoryItem<Entity>[]> = new Map();
        for (let iter = minHeight; iter <= maxHeight; iter++) {
            const resp = await this.historyDb!.get<ChangesHistoryItem<Entity>[]>(iter);
            if (resp !== undefined) {
                result.set(iter, resp);
            }
        }
        return result;
    }

    async deleteLastBlock(height: number): Promise<void> {
        if (height !== this.lastBlockHeight) {
            throw new Error(`invalid last block height '${height}`);
        }

        await this.blockDb!.batch([
            {
                type: "del",
                key: height
            },
            {
                type: "put",
                key: keyLastBlockHeight,
                value: this.getLastHeightJson(height - 1)
            }
        ]);
        await this.historyDb!.del(height);
        this.lastHeight--;
    }

    async getBlockById(blockId: string): Promise<MaybeUndefined<BlockHeader>> {
        return await this.blockDb!.getBy<BlockHeader>("id", blockId, undefined);
    }

    async getBlocksByHeightRange(minHeight: number, maxHeight: number): Promise<BlockHeader[]> {
        const results: BlockHeader[] = [];
        for (let i = minHeight; i <= maxHeight; i++) {
            const block = await this.getBlock(i);
            if (block !== undefined) {
                results.push(block);
            }
        }
        return results;
    }

    async getBlocksByIds(blockIds: string[]): Promise<BlockHeader[]> {
        const results: BlockHeader[] = [];
        for (let i = 0; i < blockIds.length; i++) {
            const block = await this.getBlockById(blockIds[i]);
            if (block !== undefined) {
                results.push(block);
            }
        }
        return results;
    }

    ////
    private getLastHeightJson(height: number): any {
        return {
            height,
            id: "NULL",
            delegate: "NULL"
        };
    }

    private async getLastBlockHeightFromDb(): Promise<number> {
        let resp = await this.blockDb!.get<{ height: number; }>(keyLastBlockHeight, {});
        if (resp === undefined) {
            resp = this.getLastHeightJson(-1);
            await this.blockDb!.put(keyLastBlockHeight, resp);
        }
        return resp!.height;
    }

    private isKeyNotFoundError(error: { name: string; }): boolean {
        return "NotFoundError" === error.name;
    }
}
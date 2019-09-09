import { MaybeUndefined } from "./Common";
import { Block } from "./Block";

type CachedHeightRange = { min: number; max: number; }

export class BlockCache {
    private cache: Map<number, Block>;
    private minHeight: number;
    private maxHeight: number;
    private maxCachedCount: number;

    constructor(maxCachedCount: number) {
        this.cache = new Map();
        this.minHeight = -1;
        this.maxHeight = -1;
        this.maxCachedCount = maxCachedCount;
    }

    isCached(height: number): boolean {
        return height > 0 && height >= this.minHeight && height <= this.maxHeight;
    }

    get cachedHeightRange(): CachedHeightRange {
        return {
            min: this.minHeight,
            max: this.maxHeight
        };
    }

    push(block: Block): void {
        if (this.maxHeight >= 0 && block.height !== this.maxHeight + 1) {
            throw new Error(`invalid block height, expected:${this.maxHeight + 1}, actual:${block.height}`);
        }
        this.cache.set(block.height, block);
        this.maxHeight = block.height;
        this.minHeight = -1 === this.minHeight ? block.height : this.minHeight;
        if (this.cache.size >= this.maxCachedCount) {
            this.cache.delete(this.minHeight++);
        }
    }

    get(height: number): MaybeUndefined<Block> {
        return this.cache.get(height);
    }

    getById(id: string): MaybeUndefined<Block> {
        for (const t of this.cache.values()) {
            if (t.id === id) {
                return t;
            }
        }

        return undefined;
    }

    evitUntil(minEvitHeight: number): void {
        if (minEvitHeight > this.maxHeight) return;

        const startHeight = Math.max(minEvitHeight, this.minHeight);
        for (let i = startHeight + 1; i <= this.maxHeight; i++) {
            this.cache.delete(i);
        }
        this.minHeight = startHeight === this.minHeight ? -1 : this.minHeight;
        this.maxHeight = -1 === this.minHeight ? -1 : startHeight;
    }
}
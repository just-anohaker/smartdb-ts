"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class BlockCache {
    constructor(maxCachedCount) {
        this.maxCachedCount = maxCachedCount;
        this.cache = new Map();
        this.minHeight = -1;
        this.maxHeight = -1;
    }
    isCached(height) {
        return height > 0 && height >= this.minHeight && height <= this.maxHeight;
    }
    get cachedHeightRange() {
        return {
            min: this.minHeight,
            max: this.maxHeight
        };
    }
    push(block) {
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
    get(height) {
        return this.cache.get(height);
    }
    getById(id) {
        for (const t of Array.from(this.cache.values())) {
            if (t.id === id) {
                return t;
            }
        }
        return undefined;
    }
    evitUntil(minEvitHeight) {
        if (minEvitHeight > this.maxHeight)
            return;
        const startHeight = Math.max(minEvitHeight, this.minHeight);
        for (let i = startHeight + 1; i <= this.maxHeight; i++) {
            this.cache.delete(i);
        }
        this.minHeight = startHeight === this.minHeight ? -1 : this.minHeight;
        this.maxHeight = -1 === this.minHeight ? -1 : startHeight;
    }
}
exports.BlockCache = BlockCache;

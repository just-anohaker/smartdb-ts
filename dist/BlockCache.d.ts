import { MaybeUndefined } from "./Common";
import { Block } from "./Block";
declare type CachedHeightRange = {
    min: number;
    max: number;
};
export declare class BlockCache {
    private maxCachedCount;
    private cache;
    private minHeight;
    private maxHeight;
    constructor(maxCachedCount: number);
    isCached(height: number): boolean;
    readonly cachedHeightRange: CachedHeightRange;
    push(block: Block): void;
    get(height: number): MaybeUndefined<Block>;
    getById(id: string): MaybeUndefined<Block>;
    evitUntil(minEvitHeight: number): void;
}
export {};

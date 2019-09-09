import { ModelSchema } from "../Model";
import { LogManager } from "../Log";
import { UniqueEntityCache, Cache, CacheKey, CacheEvitCallback } from "./EntityCache";
import LRUCache = require("lru-cache");
import { MaybeUndefined, Entity } from "../Common";

class InnerLruCache<T extends object> implements Cache<T> {
    private lruCache: LRUCache<CacheKey, T>;
    private postEvit: MaybeUndefined<CacheEvitCallback<T>>;
    constructor(private modelSchema: ModelSchema<T>, maxCache: number) {
        this.lruCache = new LRUCache<CacheKey, T>({
            max: maxCache,
            dispose: this.doEvit.bind(this)
        });
    }

    doEvit(key: CacheKey, entity: T): void {
        if (this.postEvit) {
            this.postEvit(key, entity);
        }
    }

    get model(): ModelSchema<T> {
        return this.modelSchema;
    }

    get onEvit(): CacheEvitCallback<T> {
        return this.postEvit!;
    }

    set onEvit(evit: CacheEvitCallback<T>) {
        this.postEvit = evit;
    }

    clear(): void {
        this.lruCache.reset();
    }

    has(key: CacheKey): boolean {
        return this.lruCache.has(key);
    }

    get(key: CacheKey): MaybeUndefined<T> {
        return this.lruCache.get(key);
    }

    forEach(callback: (e: T, key: CacheKey) => void): void {
        this.lruCache.forEach(callback);
    }

    set(key: CacheKey, entity: T): void {
        this.lruCache.set(key, entity);
    }

    evit(key: CacheKey): void {
        this.lruCache.del(key);
    }

    exists(key: CacheKey): boolean {
        return this.lruCache.has(key);
    }
}

export class LRUEntityCache extends UniqueEntityCache {
    static MIN_CACHED_COUNT: number = 100;
    static DEFAULT_MAX_CACHED_COUNT: number = 5e4;

    constructor(schemas: Map<string, ModelSchema<Entity>>) {
        super(LogManager.getLogger("LRUEntityCache"), schemas);
    }

    private getMaxCachedCount<T extends object>(schema: ModelSchema<T>): number {
        const val = schema.maxCached || LRUEntityCache.DEFAULT_MAX_CACHED_COUNT;
        return Math.max(LRUEntityCache.MIN_CACHED_COUNT, val);
    }

    protected createCache<T extends object>(schema: ModelSchema<T>): Cache<T> {
        return new InnerLruCache<T>(schema, this.getMaxCachedCount(schema));
    }
}
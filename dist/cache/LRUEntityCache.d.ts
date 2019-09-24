import { ModelSchema } from "../Model";
import { UniqueEntityCache, Cache } from "./EntityCache";
import { Entity } from "../Common";
export declare class LRUEntityCache extends UniqueEntityCache {
    static MIN_CACHED_COUNT: number;
    static DEFAULT_MAX_CACHED_COUNT: number;
    constructor(schemas: Map<string, ModelSchema<Entity>>);
    private getMaxCachedCount;
    protected createCache<T extends object>(schema: ModelSchema<T>): Cache<T>;
}

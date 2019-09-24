import { MaybeUndefined, Property, FilterFunction, Entity } from "../Common";
import { UniqueKey, ModelIndex, NormalizedEntityKey, ModelSchema, EntityKey } from "../Model";
import { PropertyValue } from "../tracker/EntityTracker";
import { Logger } from "../Log";
export declare type CacheKey = number | string;
export declare type CacheEvitCallback<T extends object> = (key: CacheKey, entity: T) => void;
export interface Cache<T extends object> {
    model: ModelSchema<T>;
    onEvit: CacheEvitCallback<T>;
    clear(): void;
    has(key: CacheKey): boolean;
    get(key: CacheKey): MaybeUndefined<T>;
    forEach(callback: (e: any, key: any) => void): any;
    set(key: CacheKey, entity: T): void;
    evit(key: CacheKey): void;
    exists(key: CacheKey): boolean;
}
export interface EntityUniqueIndex<T extends object> {
    indexName: string;
    fields: Property<T>[];
    exists(uniqueKey: UniqueKey<T>): boolean;
    get(uniqueKey: UniqueKey<T>): MaybeUndefined<string>;
    add(uniqueKey: UniqueKey<T>, key: string): void;
    delete(uniqueKey: UniqueKey<T>): void;
}
export declare class DefaultEntityUniqueIndex<T extends object> implements EntityUniqueIndex<T> {
    private name;
    private indexFields;
    private indexMap;
    constructor(name: string, indexFields: Property<T>[]);
    readonly indexName: string;
    readonly fields: Property<T>[];
    exists(uniqueKey: UniqueKey<T>): boolean;
    get(uniqueKey: UniqueKey<T>): MaybeUndefined<string>;
    add(uniqueKey: UniqueKey<T>, key: string): void;
    delete(uniqueKey: UniqueKey<T>): void;
    private getIndexKey;
}
export declare class UniquedCache<T extends object> {
    private cache;
    private indexes;
    constructor(cache: Cache<T>, uniquedIndexes: ModelIndex<T>[]);
    has(key: string): boolean;
    set(key: CacheKey, entity: T): void;
    get(key: CacheKey): MaybeUndefined<T>;
    forEach(callback: (entity: T, key: string) => void): void;
    evit(key: CacheKey): void;
    getUnique(uniqueIndexName: string, uniqueKey: UniqueKey<T>): MaybeUndefined<T>;
    clear(): void;
    private createUniqueIndex;
    private afterEvit;
}
export interface EntityCache {
    models: ModelSchema<Entity>[];
    clear(modelName?: string): void;
    get<T extends object>(modelName: string, key: NormalizedEntityKey<T>): MaybeUndefined<T>;
    getUnique<T extends object>(modelName: string, uniqueName: string, uniqueKey: UniqueKey<T>): MaybeUndefined<T>;
    existsUnique<T extends object>(modelName: string, uniqueName: string, uniqueKey: UniqueKey<T>): boolean;
    getAll<T extends object>(modelname: string, filter?: FilterFunction<T>): MaybeUndefined<T[]>;
    put<T extends object>(modelName: string, key: NormalizedEntityKey<T>, entity: T): void;
    evit<T extends object>(modelName: string, key: NormalizedEntityKey<T>): void;
    exists<T extends object>(modelName: string, key: NormalizedEntityKey<T>): boolean;
    existsModel(modelName: string): boolean;
    refreshCached<T extends object>(modelName: string, key: NormalizedEntityKey<T>, modifier: PropertyValue<T>[]): boolean;
}
export declare class UniqueEntityCache implements EntityCache {
    private log;
    private modelSchemas;
    private modelCaches;
    constructor(log: Logger, modelSchemas: Map<string, ModelSchema<Entity>>);
    registerModel<T extends object>(schema: ModelSchema<T>, uniqueIndexes: ModelIndex<T>[]): void;
    unRegisterModel(modelName: string): void;
    clear(modelName?: string): void;
    readonly models: ModelSchema<Entity>[];
    get<T extends object>(modelName: string, key: NormalizedEntityKey<T>): MaybeUndefined<T>;
    getUnique<T extends object>(modelName: string, uniqueName: string, uniqueKey: UniqueKey<T>): MaybeUndefined<T>;
    existsUnique<T extends object>(modelName: string, uniqueName: string, uniqueKey: UniqueKey<T>): boolean;
    refreshCached<T extends object>(modelName: string, key: NormalizedEntityKey<T>, modifier: PropertyValue<T>[]): boolean;
    getAll<T extends object>(modelName: string, filter?: FilterFunction<T>): MaybeUndefined<T[]>;
    put<T extends object>(modelName: string, key: NormalizedEntityKey<T>, entity: T): void;
    evit<T extends object>(modelName: string, key: NormalizedEntityKey<T>): void;
    exists<T extends object>(modelName: string, key: NormalizedEntityKey<T>): boolean;
    existsModel(modelName: string): boolean;
    dumpCache(): string;
    protected getModelCache<T extends object>(key: string): MaybeUndefined<UniquedCache<T>>;
    protected getCacheKey<T extends object>(key: EntityKey<T>): string;
    protected createCache<T extends object>(schema: ModelSchema<T>): Cache<T>;
}

import { MaybeUndefined, Property, FilterFunction, partialCopy, NotImplementError, isPrimitiveKey, Entity } from "../Common";
import { UniqueKey, ModelIndex, NormalizedEntityKey, ModelSchema, EntityKey } from "../Model"
import { PropertyValue } from "../tracker/EntityTracker";
import { Logger } from "../Log";
import { Utils } from "../Utils";

export type CacheKey = number | string;

export type CacheEvitCallback<T extends object> = (key: CacheKey, entity: T) => void;

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

export class DefaultEntityUniqueIndex<T extends object> implements EntityUniqueIndex<T> {
    private indexMap: Map<string, string>;
    constructor(private name: string, private indexFields: Property<T>[]) {
        this.indexMap = new Map();
    }

    get indexName(): string {
        return this.name;
    }

    get fields(): Property<T>[] {
        return this.indexFields;
    }

    exists(uniqueKey: UniqueKey<T>): boolean {
        return this.indexMap.has(this.getIndexKey(uniqueKey));
    }

    get(uniqueKey: UniqueKey<T>): MaybeUndefined<string> {
        return this.indexMap.get(this.getIndexKey(uniqueKey));
    }

    add(uniqueKey: UniqueKey<T>, key: string): void {
        const idxKey = this.getIndexKey(uniqueKey);
        if (this.indexMap.has(idxKey)) {
            throw new Error(`Unique named '${this.name}' key = '${idxKey}' exists already`);
        }
        this.indexMap.set(idxKey, key);
    }

    delete(uniqueKey: UniqueKey<T>): void {
        this.indexMap.delete(this.getIndexKey(uniqueKey));
    }

    ////
    private getIndexKey(key: UniqueKey<T>): string {
        return JSON.stringify(key);
    }
}

export class UniquedCache<T extends object> {
    private indexes: Map<string, EntityUniqueIndex<T>>;
    constructor(private cache: Cache<T>, uniquedIndexes: ModelIndex<T>[]) {
        this.cache.onEvit = this.afterEvit.bind(this);

        this.indexes = new Map();
        uniquedIndexes.forEach(value => {
            this.indexes.set(value.name, this.createUniqueIndex(value))
        });
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    set(key: CacheKey, entity: T): void {
        if (this.cache.has(key)) {
            this.evit(key);
        }
        this.cache.set(key, entity);
        this.indexes.forEach(value => {
            if (value.fields.some(val => !entity[val])) {
                return;
            }
            const uniqueKey = partialCopy(entity, value.fields);
            value.add(uniqueKey, String(key));
        });
    }

    get(key: CacheKey): MaybeUndefined<T> {
        return this.cache.get(key);
    }

    forEach(callback: (entity: T, key: string) => void): void {
        this.cache.forEach(callback);
    }

    evit(key: CacheKey): void {
        const entity = this.cache.get(key);
        if (entity !== undefined) {
            this.cache.evit(key);
            this.afterEvit(key, entity);
        }
    }

    getUnique(uniqueIndexName: string, uniqueKey: UniqueKey<T>): MaybeUndefined<T> {
        const entityUniqueIndex = this.indexes.get(uniqueIndexName);
        if (entityUniqueIndex === undefined) {
            return undefined;
        }
        const uniqueIdx = entityUniqueIndex.get(uniqueKey);
        if (uniqueIdx === undefined) {
            return undefined;
        }
        return this.cache.get(uniqueIdx);
    }

    clear(): void {
        this.forEach((entity: T, key: string): void => {
            this.evit(key);
        });
    }

    ////
    private createUniqueIndex(index: ModelIndex<T>): EntityUniqueIndex<T> {
        return new DefaultEntityUniqueIndex<T>(index.name, index.properties);
    }

    private afterEvit(key: CacheKey, entity: T) {
        this.indexes.forEach(value => {
            const delKey = partialCopy(entity, value.fields);
            value.delete(delKey);
        });
    }
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

export class UniqueEntityCache implements EntityCache {
    private modelCaches: Map<string, any>;
    constructor(private log: Logger, private modelSchemas: Map<string, ModelSchema<Entity>>) {
        this.modelCaches = new Map();
    }

    registerModel<T extends object>(schema: ModelSchema<T>, uniqueIndexes: ModelIndex<T>[]): void {
        const name = schema.modelName;
        if (this.modelCaches.has(name)) {
            throw new Error(`model '${name}' exists already`);
        }
        const cache = this.createCache(schema);
        this.modelCaches.set(name, new UniquedCache<T>(cache, uniqueIndexes));
    }

    unRegisterModel(modelName: string): void {
        this.modelCaches.delete(modelName);
    }

    clear(modelName?: string): void {
        if (Utils.Lang.isString(modelName)) {
            const uniqueCache = this.getModelCache<any>(modelName as string);
            if (uniqueCache) {
                uniqueCache.clear();
            }
            this.modelCaches.delete(modelName as string);
            return;
        }
        for (let value of Array.from(this.modelCaches.values())) {
            value.clear();
        }
        this.modelCaches.clear();
    }

    get models(): ModelSchema<Entity>[] {
        return [...Array.from(this.modelSchemas.values())];
    }

    get<T extends object>(modelName: string, key: NormalizedEntityKey<T>): MaybeUndefined<T> {
        const cache = this.getModelCache<T>(modelName);
        if (cache === undefined) return undefined;
        const cacheKey = this.getCacheKey<T>(key);
        if (this.modelCaches.has(modelName) && cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }
        return undefined;
    }

    getUnique<T extends object>(modelName: string, uniqueName: string, uniqueKey: UniqueKey<T>): MaybeUndefined<T> {
        const uniqueCache = this.getModelCache<T>(modelName);
        if (uniqueCache) {
            return uniqueCache.getUnique(uniqueName, uniqueKey);
        }
        return undefined;
    }

    existsUnique<T extends object>(modelName: string, uniqueName: string, uniqueKey: UniqueKey<T>): boolean {
        return this.getUnique<T>(modelName, uniqueName, uniqueKey) !== undefined;
    }

    refreshCached<T extends object>(modelName: string, key: NormalizedEntityKey<T>, modifier: PropertyValue<T>[]): boolean {
        const value = this.get(modelName, key);
        if (value === undefined) {
            return false;
        }

        const modifierNames = modifier.map(value => value.name);
        const schema = this.modelSchemas.get(modelName);
        if (schema === undefined) {
            return false;
        }

        if (schema.hasUniqueProperty(...modifierNames)) {
            if (this.log.traceEnabled) {
                this.log.trace(`refresh cached with uniqued index, key=${JSON.stringify(key)} modifier=${JSON.stringify(modifier)}`);
            }
            this.evit(modelName, key);
            modifier.forEach(val => value[val.name] = val.value);
            this.put(modelName, key, value);
            return true;
        } else {
            if (this.log.traceEnabled) {
                this.log.trace(`refresh cached entity, key=${JSON.stringify(key)} modifier=${JSON.stringify(modifier)}`);
            }
            modifier.forEach(val => value[val.name] = val.value);
            return false;
        }
    }

    getAll<T extends object>(modelName: string, filter?: FilterFunction<T>): MaybeUndefined<T[]> {
        const result: T[] = [];
        const uniqueCache = this.getModelCache<T>(modelName);
        if (uniqueCache) {
            uniqueCache.forEach(value => {
                if (!filter || (filter && filter(modelName as any))) {
                    result.push(value);
                }
            });
            return result;
        }

        return undefined;
    }

    put<T extends object>(modelName: string, key: NormalizedEntityKey<T>, entity: T): void {
        if (this.log.traceEnabled) {
            this.log.trace(`put cache,model=${modelName},key=${JSON.stringify(key)},entity=${JSON.stringify(entity)}`);
        }
        const uniqueCache = this.getModelCache<T>(modelName);
        if (uniqueCache) {
            uniqueCache.set(this.getCacheKey<T>(key), entity);
        }
    }

    evit<T extends object>(modelName: string, key: NormalizedEntityKey<T>): void {
        const cacheKey = this.getCacheKey<T>(key);
        if (this.log.traceEnabled) {
            this.log.trace(`evit cache,model=${modelName},key=${cacheKey}`);
        }
        const uniqueCache = this.getModelCache<T>(modelName);
        if (uniqueCache) {
            uniqueCache.evit(cacheKey);
        }
    }

    exists<T extends object>(modelName: string, key: NormalizedEntityKey<T>): boolean {
        const cachedKey = this.getCacheKey<T>(key);
        return this.get<T>(modelName, cachedKey as any) !== undefined;
    }

    existsModel(modelName: string): boolean {
        return this.modelCaches.has(modelName);
    }

    dumpCache(): string {
        let e = "---------------- DUMP CACHE ----------------\n\n";
        this.modelCaches.forEach((value, index) => {
            e += `---------------- Model ${index} ----------------` + "\n";
            value.forEach((val: any, idx: any) => {
                e += `key = ${this.getCacheKey(idx)}, entity={${JSON.stringify(val)}}`;
                e += "\n";
            });
            e += "\n";
        });
        e += "---------------- END DUMP ----------------\n";
        return e;
    }

    ////
    protected getModelCache<T extends object>(key: string): MaybeUndefined<UniquedCache<T>> {
        const schema = this.modelSchemas.get(key)
        if (schema === undefined) {
            throw new Error(`Model schema (name='${key}') does not exists`);
        }
        if (!this.modelCaches.has(key)) {
            this.registerModel<Entity>(schema, schema.uniqueIndexes);
        }

        return this.modelCaches.get(key) as UniquedCache<T>;
    }

    protected getCacheKey<T extends object>(key: EntityKey<T>): string {
        if (isPrimitiveKey(key)) {
            return String(key);
        }
        return JSON.stringify(key);
    }

    protected createCache<T extends object>(schema: ModelSchema<T>): Cache<T> {
        throw new NotImplementError();
    }
}
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Common_1 = require("../Common");
const Utils_1 = require("../Utils");
class DefaultEntityUniqueIndex {
    constructor(name, indexFields) {
        this.name = name;
        this.indexFields = indexFields;
        this.indexMap = new Map();
    }
    get indexName() {
        return this.name;
    }
    get fields() {
        return this.indexFields;
    }
    exists(uniqueKey) {
        return this.indexMap.has(this.getIndexKey(uniqueKey));
    }
    get(uniqueKey) {
        return this.indexMap.get(this.getIndexKey(uniqueKey));
    }
    add(uniqueKey, key) {
        const idxKey = this.getIndexKey(uniqueKey);
        if (this.indexMap.has(idxKey)) {
            throw new Error(`Unique named '${this.name}' key = '${idxKey}' exists already`);
        }
        this.indexMap.set(idxKey, key);
    }
    delete(uniqueKey) {
        this.indexMap.delete(this.getIndexKey(uniqueKey));
    }
    ////
    getIndexKey(key) {
        return JSON.stringify(key);
    }
}
exports.DefaultEntityUniqueIndex = DefaultEntityUniqueIndex;
class UniquedCache {
    constructor(cache, uniquedIndexes) {
        this.cache = cache;
        this.cache.onEvit = this.afterEvit.bind(this);
        this.indexes = new Map();
        uniquedIndexes.forEach(value => {
            this.indexes.set(value.name, this.createUniqueIndex(value));
        });
    }
    has(key) {
        return this.cache.has(key);
    }
    set(key, entity) {
        if (this.cache.has(key)) {
            this.evit(key);
        }
        this.cache.set(key, entity);
        this.indexes.forEach(value => {
            if (value.fields.some(val => !entity[val])) {
                return;
            }
            const uniqueKey = Common_1.partialCopy(entity, value.fields);
            value.add(uniqueKey, String(key));
        });
    }
    get(key) {
        return this.cache.get(key);
    }
    forEach(callback) {
        this.cache.forEach(callback);
    }
    evit(key) {
        const entity = this.cache.get(key);
        if (entity !== undefined) {
            this.cache.evit(key);
            this.afterEvit(key, entity);
        }
    }
    getUnique(uniqueIndexName, uniqueKey) {
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
    clear() {
        this.forEach((entity, key) => {
            this.evit(key);
        });
    }
    ////
    createUniqueIndex(index) {
        return new DefaultEntityUniqueIndex(index.name, index.properties);
    }
    afterEvit(key, entity) {
        this.indexes.forEach(value => {
            const delKey = Common_1.partialCopy(entity, value.fields);
            value.delete(delKey);
        });
    }
}
exports.UniquedCache = UniquedCache;
class UniqueEntityCache {
    constructor(log, modelSchemas) {
        this.log = log;
        this.modelSchemas = modelSchemas;
        this.modelCaches = new Map();
    }
    registerModel(schema, uniqueIndexes) {
        const name = schema.modelName;
        if (this.modelCaches.has(name)) {
            throw new Error(`model '${name}' exists already`);
        }
        const cache = this.createCache(schema);
        this.modelCaches.set(name, new UniquedCache(cache, uniqueIndexes));
    }
    unRegisterModel(modelName) {
        this.modelCaches.delete(modelName);
    }
    clear(modelName) {
        if (Utils_1.Utils.Lang.isString(modelName)) {
            const uniqueCache = this.getModelCache(modelName);
            if (uniqueCache) {
                uniqueCache.clear();
            }
            this.modelCaches.delete(modelName);
            return;
        }
        for (let value of Array.from(this.modelCaches.values())) {
            value.clear();
        }
        this.modelCaches.clear();
    }
    get models() {
        return [...Array.from(this.modelSchemas.values())];
    }
    get(modelName, key) {
        const cache = this.getModelCache(modelName);
        if (cache === undefined)
            return undefined;
        const cacheKey = this.getCacheKey(key);
        if (this.modelCaches.has(modelName) && cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }
        return undefined;
    }
    getUnique(modelName, uniqueName, uniqueKey) {
        const uniqueCache = this.getModelCache(modelName);
        if (uniqueCache) {
            return uniqueCache.getUnique(uniqueName, uniqueKey);
        }
        return undefined;
    }
    existsUnique(modelName, uniqueName, uniqueKey) {
        return this.getUnique(modelName, uniqueName, uniqueKey) !== undefined;
    }
    refreshCached(modelName, key, modifier) {
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
        }
        else {
            if (this.log.traceEnabled) {
                this.log.trace(`refresh cached entity, key=${JSON.stringify(key)} modifier=${JSON.stringify(modifier)}`);
            }
            modifier.forEach(val => value[val.name] = val.value);
            return false;
        }
    }
    getAll(modelName, filter) {
        const result = [];
        const uniqueCache = this.getModelCache(modelName);
        if (uniqueCache) {
            uniqueCache.forEach(value => {
                if (!filter || (filter && filter(modelName))) {
                    result.push(value);
                }
            });
            return result;
        }
        return undefined;
    }
    put(modelName, key, entity) {
        if (this.log.traceEnabled) {
            this.log.trace(`put cache,model=${modelName},key=${JSON.stringify(key)},entity=${JSON.stringify(entity)}`);
        }
        const uniqueCache = this.getModelCache(modelName);
        if (uniqueCache) {
            uniqueCache.set(this.getCacheKey(key), entity);
        }
    }
    evit(modelName, key) {
        const cacheKey = this.getCacheKey(key);
        if (this.log.traceEnabled) {
            this.log.trace(`evit cache,model=${modelName},key=${cacheKey}`);
        }
        const uniqueCache = this.getModelCache(modelName);
        if (uniqueCache) {
            uniqueCache.evit(cacheKey);
        }
    }
    exists(modelName, key) {
        const cachedKey = this.getCacheKey(key);
        return this.get(modelName, cachedKey) !== undefined;
    }
    existsModel(modelName) {
        return this.modelCaches.has(modelName);
    }
    dumpCache() {
        let e = "---------------- DUMP CACHE ----------------\n\n";
        this.modelCaches.forEach((value, index) => {
            e += `---------------- Model ${index} ----------------` + "\n";
            value.forEach((val, idx) => {
                e += `key = ${this.getCacheKey(idx)}, entity={${JSON.stringify(val)}}`;
                e += "\n";
            });
            e += "\n";
        });
        e += "---------------- END DUMP ----------------\n";
        return e;
    }
    ////
    getModelCache(key) {
        const schema = this.modelSchemas.get(key);
        if (schema === undefined) {
            throw new Error(`Model schema (name='${key}') does not exists`);
        }
        if (!this.modelCaches.has(key)) {
            this.registerModel(schema, schema.uniqueIndexes);
        }
        return this.modelCaches.get(key);
    }
    getCacheKey(key) {
        if (Common_1.isPrimitiveKey(key)) {
            return String(key);
        }
        return JSON.stringify(key);
    }
    createCache(schema) {
        throw new Common_1.NotImplementError();
    }
}
exports.UniqueEntityCache = UniqueEntityCache;

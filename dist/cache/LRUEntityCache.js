"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Log_1 = require("../Log");
const EntityCache_1 = require("./EntityCache");
const LRUCache = require("lru-cache");
class InnerLruCache {
    constructor(modelSchema, maxCache) {
        this.modelSchema = modelSchema;
        this.lruCache = new LRUCache({
            max: maxCache,
            dispose: this.doEvit.bind(this)
        });
    }
    doEvit(key, entity) {
        if (this.postEvit) {
            this.postEvit(key, entity);
        }
    }
    get model() {
        return this.modelSchema;
    }
    get onEvit() {
        return this.postEvit;
    }
    set onEvit(evit) {
        this.postEvit = evit;
    }
    clear() {
        this.lruCache.reset();
    }
    has(key) {
        return this.lruCache.has(key);
    }
    get(key) {
        return this.lruCache.get(key);
    }
    forEach(callback) {
        this.lruCache.forEach(callback);
    }
    set(key, entity) {
        this.lruCache.set(key, entity);
    }
    evit(key) {
        this.lruCache.del(key);
    }
    exists(key) {
        return this.lruCache.has(key);
    }
}
class LRUEntityCache extends EntityCache_1.UniqueEntityCache {
    constructor(schemas) {
        super(Log_1.LogManager.getLogger("LRUEntityCache"), schemas);
    }
    //// 
    getMaxCachedCount(schema) {
        const val = schema.maxCached || LRUEntityCache.DEFAULT_MAX_CACHED_COUNT;
        return Math.max(LRUEntityCache.MIN_CACHED_COUNT, val);
    }
    createCache(schema) {
        return new InnerLruCache(schema, this.getMaxCachedCount(schema));
    }
}
exports.LRUEntityCache = LRUEntityCache;
LRUEntityCache.MIN_CACHED_COUNT = 100;
LRUEntityCache.DEFAULT_MAX_CACHED_COUNT = 5e4;

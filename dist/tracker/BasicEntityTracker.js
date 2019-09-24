"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Common_1 = require("../Common");
const EntityTracker_1 = require("./EntityTracker");
const Utils_1 = require("../Utils");
exports.Stack = Array;
class BasicEntityTracker {
    constructor(cache, schemas, maxHistoryVersionsHold, log, doLoadHistory) {
        this.cache = cache;
        this.schemas = schemas;
        this.maxHistoryVersionsHold = maxHistoryVersionsHold;
        this.log = log;
        this.doLoadHistory = doLoadHistory;
        this.confirming = false;
        this.history = new Map();
        this.allTrackingEntities = new Map();
        this.confirmedChanges = new exports.Stack();
        this.unconfirmedChanges = new exports.Stack();
        this.minVersion = -1;
        this.currentVersion = -1;
    }
    initVersion(version) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentVersion === -1) {
                const history = yield this.loadHistory(version, version);
                this.attachHistory(history);
            }
        });
    }
    makeModelAndKey(schema, key) {
        return JSON.stringify({ m: schema.modelName, k: key });
    }
    splitModelAndKey(modelAndKey) {
        try {
            const parseResult = JSON.parse(modelAndKey);
            return {
                model: parseResult.m,
                key: parseResult.k
            };
        }
        catch (error) {
            // TODO
            return { model: "", key: "" };
        }
    }
    get trackingEntities() {
        return this.allTrackingEntities.values();
    }
    isTracking(schema, key) {
        const trackingKey = this.makeModelAndKey(schema, key);
        return this.allTrackingEntities.has(trackingKey);
    }
    getConfirmedChanges() {
        return this.confirmedChanges;
    }
    trackNew(schema, entity) {
        const key = schema.getNormalizedPrimaryKey(entity);
        this.ensureNotracking(schema, key);
        const deepCopyEntity = Utils_1.Utils.Lang.cloneDeep(entity);
        schema.setDefaultValues(deepCopyEntity);
        deepCopyEntity[EntityTracker_1.ENTITY_VERSION_PROPERTY] = 1;
        const newEntity = this.buildTrackingEntity(schema, deepCopyEntity, EntityTracker_1.EntityState.New);
        this.cache.put(schema.modelName, key, newEntity);
        this.changesStack.push(this.buildCreateChanges(schema, deepCopyEntity));
        return newEntity;
    }
    trackPersistent(schema, entity) {
        const key = schema.getNormalizedPrimaryKey(entity);
        this.ensureNotracking(schema, key);
        const deepCopyEntity = Utils_1.Utils.Lang.cloneDeep(entity);
        const newEntity = this.buildTrackingEntity(schema, deepCopyEntity, EntityTracker_1.EntityState.Persistent);
        this.cache.put(schema.modelName, key, newEntity);
        return newEntity;
    }
    trackDelete(schema, te) {
        this.changesStack.push(this.buildDeleteChanges(schema, te, te._version_));
        this.cache.evit(schema.modelName, schema.getNormalizedPrimaryKey(te));
    }
    trackModify(schema, te, modifier) {
        const modifyProperties = Object.keys(modifier)
            .filter(value => schema.isValidProperty(value) && value !== EntityTracker_1.ENTITY_VERSION_PROPERTY && !Utils_1.Utils.Lang.isEqual(te[value], modifier[value]))
            .map(value => ({
            name: value,
            value: modifier[value]
        }));
        if (modifyProperties.length !== 0) {
            this.changesStack.push(this.buildModifyChanges(schema, te, modifyProperties, ++te._version_));
            this.cache.refreshCached(schema.modelName, schema.getNormalizedPrimaryKey(te), modifyProperties);
        }
    }
    getTrackingEntity(schema, key) {
        const resolveKey = schema.resolveKey(key);
        if (resolveKey !== undefined) {
            return resolveKey.isPrimaryKey
                ? this.cache.get(schema.modelName, resolveKey.key)
                : this.cache.getUnique(schema.modelName, resolveKey.uniqueName, resolveKey.key);
        }
        return undefined;
    }
    acceptChanges(historyVersion) {
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN acceptChanges Version=${historyVersion}`);
        }
        this.history.set(historyVersion, this.confirmedChanges);
        this.confirmedChanges = new exports.Stack();
        this.removeExpiredHistory();
        this.allTrackingEntities.clear();
        this.minVersion = this.minVersion === -1 ? historyVersion : this.minVersion;
        this.currentVersion = historyVersion;
        if (this.log.traceEnabled) {
            this.log.trace(`SUCCESS acceptChanges Version=${historyVersion}`);
        }
    }
    rejectChanges() {
        this.cancelConfirm();
        this.undoChanges(this.confirmedChanges);
    }
    rollbackChanges(historyVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            if (historyVersion > this.currentVersion) {
                return;
            }
            const holdVersion = this.currentVersion;
            if (this.log.traceEnabled) {
                this.log.trace(`BEGIN rollbackChanges Version : ${holdVersion}`);
            }
            yield this.loadHistoryUntil(historyVersion);
            while (this.currentVersion >= historyVersion) {
                const hversion = this.getHistoryByVersion(this.currentVersion);
                this.undoChanges(hversion);
                this.currentVersion--;
            }
            this.minVersion = Math.min(this.minVersion, this.currentVersion);
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS rollbackChanges Version: ${holdVersion}->${this.currentVersion}`);
            }
        });
    }
    get isConfirming() {
        return this.confirming;
    }
    beginConfirm() {
        this.confirming = true;
        if (this.unconfirmedChanges.length > 0 && this.log.warnEnabled) {
            this.log.warn(`unconfirmed changes(${this.unconfirmedChanges.length}) detected, you should call commit or cancel changes`);
        }
        this.unconfirmedChanges = new exports.Stack();
        if (this.log.traceEnabled) {
            this.log.trace("BEGIN beginConfirm");
        }
    }
    confirm() {
        this.confirmedChanges.push(...this.unconfirmedChanges);
        this.unconfirmedChanges = new exports.Stack();
        this.confirming = false;
        if (this.log.traceEnabled) {
            this.log.trace("SUCCESS confirm");
        }
    }
    cancelConfirm() {
        this.undoChanges(this.unconfirmedChanges);
        this.confirming = false;
        if (this.log.traceEnabled) {
            this.log.trace("SUCCESS cancelConfirm");
        }
    }
    getChangesUntil(historyVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadHistoryUntil(historyVersion);
            const changes = [];
            while (historyVersion < this.currentVersion) {
                const history = this.getHistoryByVersion(historyVersion++);
                if (history !== undefined) {
                    changes.push(...history);
                }
            }
            return changes;
        });
    }
    ////
    loadHistory(fromVersion, toVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof this.doLoadHistory === "function") {
                return yield this.doLoadHistory(fromVersion, toVersion);
            }
            return new Map();
        });
    }
    attachHistory(history) {
        if (this.log.infoEnabled) {
            this.log.info(`BEGIN attachHistory history version=${JSON.stringify(this.historyVersion)}`);
        }
        history.forEach((value, key) => {
            this.history.set(key, value);
            this.minVersion = this.minVersion < 0 ? key : Math.min(key, this.minVersion);
            this.currentVersion = Math.max(key, this.currentVersion);
        });
        if (this.log.infoEnabled) {
            this.log.info(`SUCCESS attachHistory size=${JSON.stringify(history ? history.size : 0)}`);
        }
    }
    get historyVersion() {
        return {
            min: this.minVersion,
            max: this.currentVersion
        };
    }
    get changesStack() {
        return this.isConfirming ? this.unconfirmedChanges : this.confirmedChanges;
    }
    buildTrackingEntity(schema, entity, state) {
        return entity;
    }
    ensureNotracking(schema, key) {
        if (this.getTrackingEntity(schema, key) !== undefined) {
            throw new Error(`Entity (model='${schema.modelName}, key='${JSON.stringify(key)}') is tracking already`);
        }
    }
    getTracking(schema, key) {
        const entity = this.getTrackingEntity(schema, key);
        if (entity === undefined) {
            throw new Error(`Entity (model='${schema.modelName}', key=${JSON.stringify(key)}') is not tracking`);
        }
        return entity;
    }
    buildCreateChanges(schema, entity) {
        const changes = [];
        for (const prop in entity) {
            if (schema.isValidProperty(prop)) {
                changes.push({
                    name: prop,
                    current: entity[prop]
                });
            }
        }
        return {
            type: EntityTracker_1.EntityChangeType.New,
            model: schema.modelName,
            primaryKey: schema.getNormalizedPrimaryKey(entity),
            dbVersion: 1,
            propertyChanges: changes
        };
    }
    buildModifyChanges(schema, key, values, newVersion) {
        const changes = [];
        values.forEach(value => {
            changes.push({
                name: value.name,
                current: value.value,
                original: key[value.name]
            });
        });
        changes.push({
            name: EntityTracker_1.ENTITY_VERSION_PROPERTY,
            current: newVersion,
            original: newVersion - 1
        });
        return {
            type: EntityTracker_1.EntityChangeType.Modify,
            model: schema.modelName,
            primaryKey: schema.getNormalizedPrimaryKey(key),
            dbVersion: newVersion,
            propertyChanges: changes
        };
    }
    buildDeleteChanges(schema, key, version) {
        const changes = [];
        for (let prop in key) {
            if (schema.isValidProperty(prop)) {
                changes.push({
                    name: prop,
                    original: key[prop]
                });
            }
        }
        return {
            type: EntityTracker_1.EntityChangeType.Delete,
            model: schema.modelName,
            primaryKey: schema.getNormalizedPrimaryKey(key),
            dbVersion: 1,
            propertyChanges: changes
        };
    }
    undoEntityChanges(ec) {
        switch (ec.type) {
            case EntityTracker_1.EntityChangeType.New: {
                if (this.cache.get(ec.model, ec.primaryKey) !== undefined) {
                    this.cache.evit(ec.model, ec.primaryKey);
                }
                break;
            }
            case EntityTracker_1.EntityChangeType.Modify: {
                const mapResult = ec.propertyChanges.map(value => ({
                    name: value.name,
                    value: value.original
                }));
                this.cache.refreshCached(ec.model, ec.primaryKey, mapResult);
                break;
            }
            case EntityTracker_1.EntityChangeType.Delete: {
                const propertyChanges = Common_1.makeJsonObject(ec.propertyChanges, key => key.name, value => value.original);
                const delSchema = this.schemas.get(ec.model);
                const delEntity = this.buildTrackingEntity(delSchema, propertyChanges, EntityTracker_1.EntityState.Persistent);
                this.trackPersistent(delSchema, delEntity);
                break;
            }
        }
    }
    undoChanges(entityChanges) {
        let iter;
        while ((iter = entityChanges.pop()) !== undefined) {
            this.undoEntityChanges(iter);
        }
    }
    getHistoryByVersion(historyVersin, setIfNotExists = false) {
        if (!this.history.get(historyVersin) && setIfNotExists) {
            this.history.set(historyVersin, new exports.Stack());
        }
        return this.history.get(historyVersin);
    }
    loadHistoryUntil(version) {
        return __awaiter(this, void 0, void 0, function* () {
            if (version < this.minVersion) {
                const history = yield this.loadHistory(version, this.minVersion);
                this.attachHistory(history);
            }
        });
    }
    removeExpiredHistory() {
        if (this.currentVersion - this.minVersion > this.maxHistoryVersionsHold) {
            this.clearHistoryBefore(this.currentVersion - this.maxHistoryVersionsHold);
        }
    }
    clearHistoryBefore(version) {
        if (!(this.minVersion >= version || this.currentVersion < version)) {
            for (let i = this.minVersion; i < version; i++) {
                this.history.delete(i);
            }
            this.minVersion = version;
        }
    }
}
exports.BasicEntityTracker = BasicEntityTracker;

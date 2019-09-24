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
const Common_1 = require("./Common");
const Model_1 = require("./Model");
const SqlBuilder_1 = require("./sqldb/SqlBuilder");
const SnapshotEntityTracker_1 = require("./tracker/SnapshotEntityTracker");
const LRUEntityCache_1 = require("./cache/LRUEntityCache");
const TrackerSqlBuilder_1 = require("./tracker/TrackerSqlBuilder");
const Log_1 = require("./Log");
const Utils_1 = require("./Utils");
class DbSession {
    constructor(connection, onLoadHistory, sessionOptions) {
        this.connection = connection;
        this.log = Log_1.LogManager.getLogger(DbSession.name + (sessionOptions.name === undefined ? "" : `_${sessionOptions.name}`));
        this.unconfirmedLocks = new Set();
        this.confirmedLocks = new Set();
        this.sqlBuilder = new SqlBuilder_1.JsonSqlBuilder();
        this.schemas = new Map();
        this.sessionCache = new LRUEntityCache_1.LRUEntityCache(this.schemas);
        this.sessionSerial = -1;
        const maxHistoryVersionsHold = sessionOptions.maxHistoryVersionsHold || DbSession.DEFAULT_HISTORY_VERSION_HOLD;
        this.entityTracker = new SnapshotEntityTracker_1.SnapshotEntityTracker(this.sessionCache, this.schemas, maxHistoryVersionsHold, onLoadHistory);
        this.trackerSqlBuilder = new TrackerSqlBuilder_1.BasicTrackerSqlBuilder(this.entityTracker, this.schemas, this.sqlBuilder);
    }
    get isOpen() {
        return this.connection && this.connection.isConnected;
    }
    syncSchema(schema) {
        this.sqlBuilder.buildSchema(schema)
            .forEach(value => {
            this.connection.executeSync(value);
        });
    }
    updateSchema(schema) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.exists(schema, {})) {
                throw new Error(`Can not update schema(${schema.modelName}) because table is not empty`);
            }
            const sqlSchema = this.sqlBuilder.buildDropSchema(schema);
            yield this.connection.execute(sqlSchema);
            this.syncSchema(schema);
            this.registerSchema(schema);
        });
    }
    registerSchema(...schemas) {
        schemas.forEach(schema => {
            this.schemas.set(schema.modelName, schema);
        });
    }
    initSerial(serial) {
        return __awaiter(this, void 0, void 0, function* () {
            this.sessionSerial = serial;
            if (serial >= 0) {
                yield this.entityTracker.initVersion(serial);
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.reset(true);
            yield this.connection.disconnect();
        });
    }
    getAll(schema, filters) {
        if (!schema.memCached) {
            throw new Error("getAll only support in memory model");
        }
        const undefinedCond = (val) => this.undefinedIfDeleted(val) !== undefined;
        const filterCond = filters !== undefined ? ((val) => filters(val) && undefinedCond(val)) : undefinedCond;
        return this.sessionCache.getAll(schema.modelName, filterCond) || [];
    }
    loadAll(schema) {
        if (schema.memCached && this.sessionCache.existsModel(schema.modelName)) {
            const caches = this.sessionCache.getAll(schema.modelName) || [];
            return this.trackPersistentEntities(schema, caches, true);
        }
        return [];
    }
    getMany(schema, condition, cond = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const sqlSelect = this.sqlBuilder.buildSelect(schema, schema.properties, condition);
            const entities = yield this.queryEntities(schema, sqlSelect);
            return cond ? this.trackPersistentEntities(schema, entities, true) : entities;
        });
    }
    query(schema, condition, resultRange, sort, fields, join) {
        return __awaiter(this, void 0, void 0, function* () {
            const sqlSelect = this.sqlBuilder.buildSelect(schema, fields || schema.properties, condition, resultRange, sort, join);
            return yield this.queryEntities(schema, sqlSelect);
        });
    }
    queryByJson(schema, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const sqlSelect = this.sqlBuilder.buildSelect(schema, params);
            return yield this.queryEntities(schema, sqlSelect);
        });
    }
    exists(schema, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            const { query, parameters } = this.sqlBuilder.buildSelect(schema, [], condition);
            const newSql = `select exists(${query.replace(SqlBuilder_1.MULTI_SQL_SEPARATOR, "")}) as exist`;
            const queryResult = yield this.connection.query(newSql, parameters);
            return Array.isArray(queryResult) && Number.parseInt(queryResult[0].exist) > 0;
        });
    }
    count(schema, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryResult = yield this.queryByJson(schema, {
                fields: "count(*) as count",
                condition
            });
            return Array.isArray(queryResult) ? Number.parseInt(queryResult[0].count) : 0;
        });
    }
    create(schema, key) {
        const primaryKey = schema.getNormalizedPrimaryKey(key);
        if (primaryKey === undefined) {
            throw new Error(`entity must contains primary key ( model='${schema.modelName}' entity='${key}')`);
        }
        if (this.sessionCache.exists(schema.modelName, primaryKey)) {
            throw new Error(`entity exists already (model='${schema.modelName}' key='${JSON.stringify(primaryKey)}')`);
        }
        return Common_1.deepCopy(this.entityTracker.trackNew(schema, key));
    }
    load(schema, key) {
        return __awaiter(this, void 0, void 0, function* () {
            let entity = this.getCachedEntity(schema, key);
            if (entity !== undefined) {
                return entity;
            }
            const entityByKey = yield this.loadEntityByKey(schema, key);
            if (entityByKey === undefined) {
                return undefined;
            }
            const persistentEntity = this.entityTracker.trackPersistent(schema, entityByKey);
            return schema.copyProperties(persistentEntity, true);
        });
    }
    loadSync(schema, key) {
        let entity = this.getCachedEntity(schema, key);
        if (entity !== undefined) {
            return entity;
        }
        const entityByKey = this.loadEntityByKeySync(schema, key);
        if (entityByKey === undefined) {
            return undefined;
        }
        const persistentEntity = this.entityTracker.trackPersistent(schema, entityByKey);
        return schema.copyProperties(persistentEntity, true);
    }
    getChanges() {
        return this.entityTracker.getConfirmedChanges();
    }
    getTrackingOrCachedEntity(schema, key) {
        const cache = this.getCached(schema, key);
        return cache === undefined ? undefined : this.undefinedIfDeleted(cache);
    }
    getCachedEntity(schema, key) {
        const cache = this.getCached(schema, key);
        return cache === undefined ? undefined : this.undefinedIfDeleted(cache);
    }
    lockInThisSession(lockName, notThrow = false) {
        if (!(this.confirmedLocks.has(lockName) || this.unconfirmedLocks.has(lockName))) {
            this.entityTracker.isConfirming
                ? this.confirmedLocks.add(lockName)
                : this.unconfirmedLocks.add(lockName);
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS lock name='${lockName}'`);
            }
            return true;
        }
        this.log.warnEnabled && this.log.warn(`FAILED lock ${lockName}`);
        if (!notThrow) {
            throw new Error(`Lock name=${lockName} exists already`);
        }
        return false;
    }
    saveChanges(serial) {
        return __awaiter(this, void 0, void 0, function* () {
            const newSessionSerial = serial || ++this.sessionSerial;
            if (this.log.traceEnabled) {
                this.log.trace(`BEGIN saveChanges (serial=${newSessionSerial})`);
            }
            this.commitEntityTransaction();
            Utils_1.Utils.Performance.time("Build sqls");
            const sqlAndParameters = this.trackerSqlBuilder.buildChangeSqls();
            Utils_1.Utils.Performance.restartTime(`Execute sqls (${sqlAndParameters.length})`);
            const transaction = yield this.connection.beginTrans();
            try {
                yield this.connection.executeBatch(sqlAndParameters);
                yield transaction.commit();
                Utils_1.Utils.Performance.restartTime("Accept changes");
                this.entityTracker.acceptChanges(newSessionSerial);
                Utils_1.Utils.Performance.endTime(false);
                this.clearLocks();
                this.sessionSerial = newSessionSerial;
                if (this.log.traceEnabled) {
                    this.log.trace(`SUCCESS saveChanges (serial=${newSessionSerial})`);
                }
                return newSessionSerial;
            }
            catch (error) {
                if (this.log.errorEnabled) {
                    this.log.error(`FAILED saveChanges (serial=${newSessionSerial})`, error);
                }
                yield transaction.rollback();
                this.entityTracker.rejectChanges();
                throw error;
            }
        });
    }
    rollbackChanges(serial) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.sessionSerial < serial) {
                return this.sessionSerial;
            }
            const oldSerial = this.sessionSerial;
            if (this.log.traceEnabled) {
                this.log.trace(`BEGIN rollbackChanges (serial=${serial})`);
            }
            const sqlAndParameters = yield this.trackerSqlBuilder.buildRollbackChangeSqls(serial + 1);
            const transaction = yield this.connection.beginTrans();
            try {
                yield this.connection.executeBatch(sqlAndParameters);
                yield transaction.commit();
                this.entityTracker.rejectChanges();
                yield this.entityTracker.rollbackChanges(serial + 1);
                this.clearLocks();
                this.sessionSerial = serial;
                if (this.log.traceEnabled) {
                    this.log.trace(`SUCCESS rollbackChanges (serial: ${oldSerial} -> ${this.sessionSerial})`);
                }
                return this.sessionSerial;
            }
            catch (error) {
                if (this.log.errorEnabled) {
                    this.log.error(`FAILED rollbackChanges (serial: ${oldSerial} -> ${this.sessionSerial})`, error);
                }
                yield transaction.rollback();
                throw error;
            }
        });
    }
    update(schema, key, modifier) {
        const entity = this.ensureEntityTracking(schema, key);
        this.entityTracker.trackModify(schema, entity, modifier);
    }
    increase(schema, key, increasements) {
        const entity = this.ensureEntityTracking(schema, key);
        let modifier = {};
        Object.keys(entity)
            .forEach(propName => {
            modifier[propName] = entity[propName] === undefined
                ? increasements[propName]
                : increasements[propName] + entity[propName];
        });
        this.entityTracker.trackModify(schema, entity, modifier);
        return modifier;
    }
    delete(schema, key) {
        const entity = this.ensureEntityTracking(schema, key);
        this.entityTracker.trackDelete(schema, entity);
    }
    beginTransactions() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.connection.beginTrans();
        });
    }
    beginEntityTransaction() {
        this.entityTracker.beginConfirm();
    }
    commitEntityTransaction() {
        this.entityTracker.confirm();
        if (this.log.traceEnabled) {
            this.log.trace(`commit locks ${DbSession.setToString(this.unconfirmedLocks)}`);
        }
        this.unconfirmedLocks.forEach(value => {
            this.confirmedLocks.add(value);
        });
    }
    rollbackEntityTransaction() {
        this.entityTracker.cancelConfirm();
        if (this.log.traceEnabled) {
            this.log.trace(`rollback locks ${DbSession.setToString(this.unconfirmedLocks)}`);
        }
        this.unconfirmedLocks.clear();
    }
    ////
    static setToString(val) {
        return JSON.stringify(Array.from(val.keys()));
    }
    trackPersistentEntities(schema, caches, cond = false) {
        const result = [];
        caches.forEach(cache => {
            const key = schema.getPrimaryKey(cache);
            const trackingEntity = this.entityTracker.getTrackingEntity(schema, key);
            const entity = cond && trackingEntity !== undefined ? trackingEntity : this.entityTracker.trackPersistent(schema, cache);
            result.push(schema.copyProperties(entity, true));
        });
        return result;
    }
    reset(cond = false) {
        if (cond) {
            this.sessionCache.clear();
        }
    }
    undefinedIfDeleted(val) {
        return Common_1.deepCopy(val);
    }
    queryEntities(schema, sql) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryResults = yield this.connection.query(sql.query, sql.parameters);
            return this.replaceEntitiesJsonProperties(schema, queryResults);
        });
    }
    queryEntitiesSync(schema, sql) {
        const queryResults = this.connection.querySync(sql.query, sql.parameters);
        return this.replaceEntitiesJsonProperties(schema, queryResults);
    }
    replaceJsonProperties(schema, entity) {
        if (schema.jsonProperties.length === 0) {
            return entity;
        }
        const assignEntity = Object.assign({}, entity);
        schema.jsonProperties.forEach(property => {
            if (Reflect.has(assignEntity, property)) {
                assignEntity[property] = JSON.parse(String(entity[property]));
            }
        });
        return assignEntity;
    }
    replaceEntitiesJsonProperties(schema, entities) {
        if (schema.jsonProperties.length === 0) {
            return entities;
        }
        return entities.map(entity => this.replaceJsonProperties(schema, entity));
    }
    makeByKeyCondition(schema, key) {
        return schema.resolveKey(key).key;
    }
    loadEntityByKey(schema, key) {
        return __awaiter(this, void 0, void 0, function* () {
            const condition = this.makeByKeyCondition(schema, key);
            const sqlSelect = this.sqlBuilder.buildSelect(schema, schema.properties, condition);
            const queryEntities = yield this.queryEntities(schema, sqlSelect);
            if (queryEntities.length > 1) {
                throw new Error(`entity key is duplicated (model='${schema.modelName}' key='${JSON.stringify(key)}')`);
            }
            return queryEntities.length === 1 ? queryEntities[0] : undefined;
        });
    }
    loadEntityByKeySync(schema, key) {
        const condition = this.makeByKeyCondition(schema, key);
        const sqlSelect = this.sqlBuilder.buildSelect(schema, schema.properties, condition);
        const queryEntities = this.queryEntitiesSync(schema, sqlSelect);
        if (queryEntities.length > 1) {
            throw new Error(`entity key is duplicated (model='${schema.modelName}' key='${JSON.stringify(key)}')`);
        }
        return queryEntities.length === 1 ? queryEntities[0] : undefined;
    }
    normalizeEntityKey(schema, key) {
        const resolveKey = schema.resolveKey(key);
        if (resolveKey === undefined) {
            throw new Model_1.InvalidEntityKeyError(schema.modelName, key);
        }
        return resolveKey;
    }
    getCached(schema, key) {
        const resolveKey = this.normalizeEntityKey(schema, key);
        const trackingEntity = this.entityTracker.getTrackingEntity(schema, resolveKey.key);
        if (trackingEntity) {
            return trackingEntity;
        }
        return resolveKey.isPrimaryKey
            ? this.sessionCache.get(schema.modelName, resolveKey.key)
            : this.sessionCache.getUnique(schema.modelName, resolveKey.uniqueName, resolveKey.key);
    }
    clearLocks() {
        this.unconfirmedLocks.clear();
        this.confirmedLocks.clear();
    }
    confirmLocks() {
        this.unconfirmedLocks.forEach(e => this.confirmedLocks.add(e));
    }
    ensureEntityTracking(schema, key) {
        let cache = this.getCached(schema, key);
        if (cache === undefined) {
            const entityByKey = this.loadEntityByKeySync(schema, key);
            if (entityByKey === undefined) {
                throw new Error(`Entity not found (model='${schema.modelName}', key='${JSON.stringify(key)}')`);
            }
            cache = this.entityTracker.trackPersistent(schema, entityByKey);
        }
        return cache;
    }
}
exports.DbSession = DbSession;
DbSession.DEFAULT_HISTORY_VERSION_HOLD = 10;

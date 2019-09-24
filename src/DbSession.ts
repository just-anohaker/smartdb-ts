import { Nullable, MaybeUndefined, FilterFunction, Entity, JsonObject, deepCopy, ObjectLiteral } from "./Common";
import { EntityKey, NormalizedEntityKey, ModelSchema, ResolvedEntityKey, InvalidEntityKeyError } from "./Model";
import { SqlCondition, SqlOrder, SqlResultRange, JsonSqlBuilder, SqlAndParameters, MULTI_SQL_SEPARATOR } from "./sqldb/SqlBuilder";
import { DbConnection, DBTransaction } from "./sqldb/DbConnection";
import { LoadChangesHistoryAction } from "./tracker/BasicEntityTracker";
import { ChangesHistoryItem, Versioned } from "./tracker/EntityTracker";
import { SnapshotEntityTracker } from "./tracker/SnapshotEntityTracker";
import { LRUEntityCache } from "./cache/LRUEntityCache";
import { BasicTrackerSqlBuilder } from "./tracker/TrackerSqlBuilder";
import { Logger, LogManager } from "./Log";
import { Utils } from "./Utils";

export interface DbSessionOptions {
    name?: string,
    maxHistoryVersionsHold?: number;
}

export class DbSession {
    public static DEFAULT_HISTORY_VERSION_HOLD: number = 10;

    private unconfirmedLocks: Set<string>;
    private confirmedLocks: Set<string>;
    private sqlBuilder: JsonSqlBuilder;
    private schemas: Map<string, ModelSchema<Entity>>;
    private sessionCache: LRUEntityCache;
    private sessionSerial: number;
    private entityTracker: SnapshotEntityTracker;
    private trackerSqlBuilder: BasicTrackerSqlBuilder;
    private log: Logger;
    constructor(private connection: DbConnection, onLoadHistory: Nullable<LoadChangesHistoryAction>, sessionOptions: DbSessionOptions) {
        this.log = LogManager.getLogger(DbSession.name + (sessionOptions.name === undefined ? "" : `_${sessionOptions.name}`));
        this.unconfirmedLocks = new Set();
        this.confirmedLocks = new Set();
        this.sqlBuilder = new JsonSqlBuilder();
        this.schemas = new Map();
        this.sessionCache = new LRUEntityCache(this.schemas);
        this.sessionSerial = -1;
        const maxHistoryVersionsHold = sessionOptions.maxHistoryVersionsHold || DbSession.DEFAULT_HISTORY_VERSION_HOLD;
        this.entityTracker = new SnapshotEntityTracker(
            this.sessionCache,
            this.schemas,
            maxHistoryVersionsHold,
            onLoadHistory as any
        );
        this.trackerSqlBuilder = new BasicTrackerSqlBuilder(this.entityTracker, this.schemas, this.sqlBuilder);
    }

    get isOpen(): boolean {
        return this.connection && this.connection.isConnected;
    }

    syncSchema<T extends object>(schema: ModelSchema<T>): void {
        this.sqlBuilder.buildSchema(schema)
            .forEach(value => {
                this.connection.executeSync(value);
            });
    }

    async updateSchema<T extends object>(schema: ModelSchema<T>): Promise<void> {
        if (await this.exists(schema, {})) {
            throw new Error(`Can not update schema(${schema.modelName}) because table is not empty`);
        }
        const sqlSchema = this.sqlBuilder.buildDropSchema(schema);
        await this.connection.execute(sqlSchema);
        this.syncSchema(schema);
        this.registerSchema(schema as any);
    }

    registerSchema(...schemas: ModelSchema<Entity>[]): void {
        schemas.forEach(schema => {
            this.schemas.set(schema.modelName, schema);
        });
    }

    async initSerial(serial: number): Promise<void> {
        this.sessionSerial = serial;
        if (serial >= 0) {
            await this.entityTracker.initVersion(serial);
        }
    }

    async close(): Promise<void> {
        this.reset(true);
        await this.connection.disconnect();
    }

    getAll<T extends object>(schema: ModelSchema<T>, filters?: FilterFunction<T>): T[] {
        if (!schema.memCached) {
            throw new Error("getAll only support in memory model");
        }

        const undefinedCond = (val: T): boolean => this.undefinedIfDeleted(val) !== undefined;
        const filterCond = filters !== undefined ? ((val: T): boolean => filters(val) && undefinedCond(val)) : undefinedCond;
        return this.sessionCache.getAll(schema.modelName, filterCond) || [];
    }

    loadAll<T extends object>(schema: ModelSchema<T>): T[] {
        if (schema.memCached && this.sessionCache.existsModel(schema.modelName)) {
            const caches = this.sessionCache.getAll<T>(schema.modelName) || [];
            return this.trackPersistentEntities<T>(schema, caches, true);
        }

        return [];
    }

    async getMany<T extends object>(schema: ModelSchema<T>, condition: SqlCondition, cond: boolean = true): Promise<T[]> {
        const sqlSelect = this.sqlBuilder.buildSelect<T>(schema, schema.properties, condition);
        const entities = await this.queryEntities<T>(schema, sqlSelect) as any;
        return cond ? this.trackPersistentEntities<T>(schema, entities, true) : entities;
    }

    async query<T extends object>(schema: ModelSchema<T>, condition: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, fields?: string[], join?: JsonObject): Promise<T[]> {
        const sqlSelect = this.sqlBuilder.buildSelect(schema, fields || schema.properties, condition, resultRange, sort, join);
        return await this.queryEntities(schema, sqlSelect) as any;
    }

    async queryByJson<T extends object>(schema: ModelSchema<T>, params: JsonObject): Promise<T[]> {
        const sqlSelect = this.sqlBuilder.buildSelect(schema, params);
        return await this.queryEntities(schema, sqlSelect) as any;
    }

    async exists<T extends object>(schema: ModelSchema<T>, condition: SqlCondition): Promise<boolean> {
        const { query, parameters } = this.sqlBuilder.buildSelect(schema, [], condition);
        const newSql = `select exists(${query.replace(MULTI_SQL_SEPARATOR, "")}) as exist`;
        const queryResult = await this.connection.query(newSql, parameters);
        return Array.isArray(queryResult) && Number.parseInt(queryResult[0].exist) > 0;
    }

    async count<T extends object>(schema: ModelSchema<T>, condition: SqlCondition): Promise<number> {
        const queryResult = await this.queryByJson(schema, {
            fields: "count(*) as count",
            condition
        });
        return Array.isArray(queryResult) ? Number.parseInt((queryResult[0] as any).count) : 0;
    }

    create<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): T {
        const primaryKey = schema.getNormalizedPrimaryKey(key as any);
        if (primaryKey === undefined) {
            throw new Error(`entity must contains primary key ( model='${schema.modelName}' entity='${key}')`);
        }
        if (this.sessionCache.exists(schema.modelName, primaryKey)) {
            throw new Error(`entity exists already (model='${schema.modelName}' key='${JSON.stringify(primaryKey)}')`);
        }
        return deepCopy(this.entityTracker.trackNew<T>(schema, key as any));
    }

    async load<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): Promise<MaybeUndefined<T>> {
        let entity = this.getCachedEntity(schema, key);
        if (entity !== undefined) {
            return entity;
        }

        const entityByKey = await this.loadEntityByKey(schema, key);
        if (entityByKey === undefined) {
            return undefined;
        }
        const persistentEntity = this.entityTracker.trackPersistent(schema, entityByKey as any);
        return schema.copyProperties(persistentEntity, true) as any;
    }

    loadSync<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<T> {
        let entity = this.getCachedEntity(schema, key);
        if (entity !== undefined) {
            return entity;
        }

        const entityByKey = this.loadEntityByKeySync(schema, key);
        if (entityByKey === undefined) {
            return undefined;
        }
        const persistentEntity = this.entityTracker.trackPersistent(schema, entityByKey as any);
        return schema.copyProperties(persistentEntity, true) as any;
    }

    getChanges(): ChangesHistoryItem<Entity>[] {
        return this.entityTracker.getConfirmedChanges();
    }

    getTrackingOrCachedEntity<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<T> {
        const cache = this.getCached(schema, key);
        return cache === undefined ? undefined : this.undefinedIfDeleted<T>(cache);
    }

    getCachedEntity<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<T> {
        const cache = this.getCached(schema, key);
        return cache === undefined ? undefined : this.undefinedIfDeleted<T>(cache);
    }

    lockInThisSession(lockName: string, notThrow: boolean = false): boolean {
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

    async saveChanges(serial?: number): Promise<number> {
        const newSessionSerial = serial || ++this.sessionSerial;
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN saveChanges (serial=${newSessionSerial})`);
        }
        this.commitEntityTransaction();
        Utils.Performance.time("Build sqls");
        const sqlAndParameters = this.trackerSqlBuilder.buildChangeSqls();
        Utils.Performance.restartTime(`Execute sqls (${sqlAndParameters.length})`);
        const transaction = await this.connection.beginTrans();
        try {
            await this.connection.executeBatch(sqlAndParameters);
            await transaction.commit();
            Utils.Performance.restartTime("Accept changes");
            this.entityTracker.acceptChanges(newSessionSerial);
            Utils.Performance.endTime(false);
            this.clearLocks();
            this.sessionSerial = newSessionSerial;
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS saveChanges (serial=${newSessionSerial})`);
            }
            return newSessionSerial;
        } catch (error) {
            if (this.log.errorEnabled) {
                this.log.error(`FAILED saveChanges (serial=${newSessionSerial})`, error);
            }
            await transaction.rollback();
            this.entityTracker.rejectChanges();
            throw error;
        }
    }

    async rollbackChanges(serial: number): Promise<number> {
        if (this.sessionSerial < serial) {
            return this.sessionSerial;
        }

        const oldSerial = this.sessionSerial;
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN rollbackChanges (serial=${serial})`);
        }
        const sqlAndParameters = await this.trackerSqlBuilder.buildRollbackChangeSqls(serial + 1);
        const transaction = await this.connection.beginTrans();
        try {
            await this.connection.executeBatch(sqlAndParameters);
            await transaction.commit();
            this.entityTracker.rejectChanges();
            await this.entityTracker.rollbackChanges(serial + 1);
            this.clearLocks();
            this.sessionSerial = serial;
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS rollbackChanges (serial: ${oldSerial} -> ${this.sessionSerial})`);
            }
            return this.sessionSerial;
        } catch (error) {
            if (this.log.errorEnabled) {
                this.log.error(`FAILED rollbackChanges (serial: ${oldSerial} -> ${this.sessionSerial})`, error);
            }
            await transaction.rollback();
            throw error;
        }
    }

    update<T extends object>(schema: ModelSchema<T>, key: NormalizedEntityKey<T>, modifier: Partial<T>): void {
        const entity = this.ensureEntityTracking(schema, key);
        this.entityTracker.trackModify(schema, entity as Versioned<T>, modifier);
    }

    increase<T extends object>(schema: ModelSchema<T>, key: NormalizedEntityKey<T>, increasements: Partial<T>): Partial<T> {
        const entity = this.ensureEntityTracking(schema, key);
        let modifier: Partial<T> = {};
        Object.keys(entity)
            .forEach(propName => {
                modifier[propName as keyof T] = entity[propName as keyof T] === undefined
                    ? increasements[propName as keyof T]
                    : increasements[propName as keyof T] as any + entity[propName as keyof T] as any;
            });
        this.entityTracker.trackModify(schema, entity as Versioned<T>, modifier);
        return modifier;
    }

    delete<T extends object>(schema: ModelSchema<T>, key: NormalizedEntityKey<T>): void {
        const entity = this.ensureEntityTracking(schema, key);
        this.entityTracker.trackDelete(schema, entity as Versioned<T>);
    }

    async beginTransactions(): Promise<DBTransaction> {
        return await this.connection.beginTrans();
    }

    beginEntityTransaction(): void {
        this.entityTracker.beginConfirm();
    }

    commitEntityTransaction(): void {
        this.entityTracker.confirm();
        if (this.log.traceEnabled) {
            this.log.trace(`commit locks ${DbSession.setToString(this.unconfirmedLocks)}`);
        }
        this.unconfirmedLocks.forEach(value => {
            this.confirmedLocks.add(value);
        });
    }

    rollbackEntityTransaction(): void {
        this.entityTracker.cancelConfirm();
        if (this.log.traceEnabled) {
            this.log.trace(`rollback locks ${DbSession.setToString(this.unconfirmedLocks)}`);
        }
        this.unconfirmedLocks.clear();
    }

    ////
    private static setToString(val: Set<string>): string {
        return JSON.stringify(Array.from(val.keys()));
    }

    private trackPersistentEntities<T extends object>(schema: ModelSchema<T>, caches: T[], cond: boolean = false): T[] {
        const result: any[] = [];
        caches.forEach(cache => {
            const key = schema.getPrimaryKey(cache);
            const trackingEntity = this.entityTracker.getTrackingEntity(schema, key);
            const entity = cond && trackingEntity !== undefined ? trackingEntity : this.entityTracker.trackPersistent(schema, cache as Versioned<T>);
            result.push(schema.copyProperties(entity, true));
        });
        return result;
    }

    private reset(cond: boolean = false) {
        if (cond) {
            this.sessionCache.clear();
        }
    }

    private undefinedIfDeleted<T extends object>(val: T): T | undefined {
        return deepCopy(val);
    }

    private async queryEntities<T extends object>(schema: ModelSchema<T>, sql: SqlAndParameters): Promise<ObjectLiteral[]> {
        const queryResults = await this.connection.query(sql.query, sql.parameters);
        return this.replaceEntitiesJsonProperties(schema, queryResults);
    }

    private queryEntitiesSync<T extends object>(schema: ModelSchema<T>, sql: SqlAndParameters): ObjectLiteral {
        const queryResults = this.connection.querySync(sql.query, sql.parameters);
        return this.replaceEntitiesJsonProperties(schema, queryResults);
    }

    private replaceJsonProperties<T extends object>(schema: ModelSchema<T>, entity: ObjectLiteral): ObjectLiteral {
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

    private replaceEntitiesJsonProperties<T extends object>(schema: ModelSchema<T>, entities: ObjectLiteral[]): ObjectLiteral[] {
        if (schema.jsonProperties.length === 0) {
            return entities;
        }

        return entities.map(entity => this.replaceJsonProperties(schema, entity));
    }

    private makeByKeyCondition<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): Partial<T> {
        return schema.resolveKey(key)!.key;
    }

    private async loadEntityByKey<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): Promise<MaybeUndefined<ObjectLiteral>> {
        const condition = this.makeByKeyCondition(schema, key);
        const sqlSelect = this.sqlBuilder.buildSelect(schema, schema.properties, condition);
        const queryEntities = await this.queryEntities(schema, sqlSelect);
        if (queryEntities.length > 1) {
            throw new Error(`entity key is duplicated (model='${schema.modelName}' key='${JSON.stringify(key)}')`);
        }
        return queryEntities.length === 1 ? queryEntities[0] : undefined;
    }

    private loadEntityByKeySync<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<ObjectLiteral> {
        const condition = this.makeByKeyCondition(schema, key);
        const sqlSelect = this.sqlBuilder.buildSelect(schema, schema.properties, condition);
        const queryEntities = this.queryEntitiesSync(schema, sqlSelect);
        if (queryEntities.length > 1) {
            throw new Error(`entity key is duplicated (model='${schema.modelName}' key='${JSON.stringify(key)}')`);
        }
        return queryEntities.length === 1 ? queryEntities[0] : undefined;
    }

    private normalizeEntityKey<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): ResolvedEntityKey<T> {
        const resolveKey = schema.resolveKey(key);
        if (resolveKey === undefined) {
            throw new InvalidEntityKeyError(schema.modelName, key);
        }
        return resolveKey;
    }

    private getCached<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): any {
        const resolveKey = this.normalizeEntityKey(schema, key);
        const trackingEntity = this.entityTracker.getTrackingEntity(schema, resolveKey.key);
        if (trackingEntity) {
            return trackingEntity;
        }

        return resolveKey.isPrimaryKey
            ? this.sessionCache.get(schema.modelName, resolveKey.key)
            : this.sessionCache.getUnique(schema.modelName, resolveKey.uniqueName, resolveKey.key);
    }

    private clearLocks(): void {
        this.unconfirmedLocks.clear();
        this.confirmedLocks.clear();
    }

    private confirmLocks(): void {
        this.unconfirmedLocks.forEach(e => this.confirmedLocks.add(e));
    }

    private ensureEntityTracking<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): Partial<T> {
        let cache = this.getCached(schema, key);
        if (cache === undefined) {
            const entityByKey = this.loadEntityByKeySync(schema, key);
            if (entityByKey === undefined) {
                throw new Error(`Entity not found (model='${schema.modelName}', key='${JSON.stringify(key)}')`);
            }
            cache = this.entityTracker.trackPersistent(schema, entityByKey as any);
        }
        return cache;
    }
}
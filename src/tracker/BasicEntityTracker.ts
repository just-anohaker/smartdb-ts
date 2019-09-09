import { MaybeUndefined, Entity, Nullable, astype, Property, makeJsonObject } from "../Common";
import { PrimaryKey, EntityKey, ModelSchema } from "../Model";
import { Logger } from "../Log";
import {
    EntityTracker,
    TrackingEntity,
    ModelAndKey,
    EntityChanges,
    Versioned,
    ChangesHistoryItem,
    EntityState,
    ENTITY_VERSION_PROPERTY,
    PropertyChange,
    EntityChangeType,
    PropertyValue
} from "./EntityTracker";
import { EntityCache } from "../cache/EntityCache";
import { Utils } from "../Utils";

export type LoadChangesHistoryAction = (fromVersion: number, toVersion: number) => Promise<Map<number, ChangesHistoryItem<Entity>[]>>;

export type Stack<T> = Array<T>;

export const Stack: ArrayConstructor = Array;

export class BasicEntityTracker implements EntityTracker {
    private confirming: boolean;
    private minVersion: number;
    private currentVersion: number;
    private history: Map<number, ChangesHistoryItem<Entity>[]>;
    private allTrackingEntities: Map<string, TrackingEntity<Entity>>;
    private confirmedChanges: Stack<ChangesHistoryItem<Entity>>;
    private unconfirmedChanges: Stack<ChangesHistoryItem<Entity>>;

    constructor(private cache: EntityCache,
        private schemas: Map<string, ModelSchema<Entity>>,
        private maxHistoryVersionsHold: number,
        private log: Logger,
        private doLoadHistory?: Nullable<LoadChangesHistoryAction>) {
        this.confirming = false;
        this.history = new Map();
        this.allTrackingEntities = new Map();
        this.confirmedChanges = new Stack();
        this.unconfirmedChanges = new Stack();
        this.minVersion = -1;
        this.currentVersion = -1;
    }

    async loadHistory(fromVersion: number, toVersion: number): Promise<Map<number, ChangesHistoryItem<Entity>[]>> {
        if (this.doLoadHistory) {
            return this.doLoadHistory(fromVersion, toVersion);
        }

        return new Map();
    }

    async initVersion(version: number): Promise<void> {
        if (this.currentVersion === -1) {
            const history = await this.loadHistory(version, version);
            this.attachHistory(history);
        }
    }

    private attachHistory(history: Map<number, ChangesHistoryItem<Entity>[]>): void {
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

    private get historyVersion(): { min: number, max: number } {
        return {
            min: this.minVersion,
            max: this.currentVersion
        };
    }

    makeModelAndKey<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): ModelAndKey {
        return JSON.stringify({ m: schema.modelName, k: key });
    }

    splitModelAndKey<T extends object>(modelAndKey: ModelAndKey): { model: string; key: PrimaryKey<T>; } {
        const parseResult = JSON.parse(modelAndKey);
        return {
            model: parseResult.m,
            key: parseResult.k
        };
    }

    get trackingEntities(): IterableIterator<TrackingEntity<Entity>> {
        return this.allTrackingEntities.values();
    }

    isTracking<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): boolean {
        const trackingKey = this.makeModelAndKey(schema, key);
        return this.allTrackingEntities.has(trackingKey);
    }

    getConfirmedChanges(): EntityChanges<Entity>[] {
        return this.confirmedChanges;
    }

    private get changesStack(): Stack<ChangesHistoryItem<Entity>> {
        return this.isConfirming ? this.unconfirmedChanges : this.confirmedChanges;
    }

    private buildTrackingEntity<T extends object>(schema: ModelSchema<T>, entity: TrackingEntity<T>, state: EntityState): TrackingEntity<T> {
        return entity;
    }

    private ensureNotracking<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>) {
        if (this.getTrackingEntity(schema, key) !== undefined) {
            throw new Error(`Entity (model='${schema.modelName}, key='${JSON.stringify(key)}') is tracking already`);
        }
    }

    private getTracking<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): MaybeUndefined<TrackingEntity<T>> {
        const entity = this.getTrackingEntity(schema, key);
        if (entity === undefined) {
            throw new Error(`Entity (model='${schema.modelName}', key=${JSON.stringify(key)}') is not tracking`);
        }
        return entity;
    }

    trackNew<T extends object>(schema: ModelSchema<T>, entity: T): TrackingEntity<T> {
        const key = schema.getNormalizedPrimaryKey(entity);
        this.ensureNotracking(schema, key);
        const deepCopyEntity = Utils.Lang.cloneDeep(entity);
        schema.setDefaultValues(deepCopyEntity);
        deepCopyEntity[ENTITY_VERSION_PROPERTY] = 1;
        const newEntity = this.buildTrackingEntity(schema, deepCopyEntity, EntityState.New);
        this.cache.put(schema.modelName, key, newEntity);
        this.changesStack.push(this.buildCreateChanges(schema, deepCopyEntity));
        return newEntity;
    }

    trackPersistent<T extends object>(schema: ModelSchema<T>, entity: Versioned<T>): TrackingEntity<T> {
        const key = schema.getNormalizedPrimaryKey(entity);
        this.ensureNotracking(schema, key);
        const deepCopyEntity = Utils.Lang.cloneDeep(entity);
        const newEntity = this.buildTrackingEntity(schema, deepCopyEntity, EntityState.Persistent);
        this.cache.put(schema.modelName, key, newEntity);
        return newEntity;
    }

    trackDelete<T extends object>(schema: ModelSchema<T>, te: TrackingEntity<T>): void {
        this.changesStack.push(this.buildDeleteChanges(schema, te, te._version_));
        this.cache.evit(schema.modelName, schema.getNormalizedPrimaryKey(te));
    }

    trackModify<T extends object>(schema: ModelSchema<T>, te: TrackingEntity<T>, modifier: Partial<T>): void {
        const modifyProperties: PropertyValue<T>[] = Object.keys(modifier)
            .filter(value => schema.isValidProperty(value) && value !== ENTITY_VERSION_PROPERTY && !Utils.Lang.isEqual(te[value as keyof T], modifier[value as keyof T]))
            .map(value => ({
                name: astype<Property<T>>(value),
                value: modifier[value as keyof T]
            }));
        if (modifyProperties.length !== 0) {
            this.changesStack.push(this.buildModifyChanges(schema, te, modifyProperties, ++te._version_));
            this.cache.refreshCached(schema.modelName, schema.getNormalizedPrimaryKey(te), modifyProperties);
        }
    }

    getTrackingEntity<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<TrackingEntity<T>> {
        const resolveKey = schema.resolveKey(key);
        if (resolveKey !== undefined) {
            return resolveKey.isPrimaryKey
                ? astype<TrackingEntity<T>>(this.cache.get(schema.modelName, resolveKey.key))
                : astype<TrackingEntity<T>>(this.cache.getUnique(schema.modelName, resolveKey.uniqueName, resolveKey.key));
        }
        return undefined;
    }

    acceptChanges(historyVersion: number): void {
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN acceptChanges Version=${historyVersion}`);
        }
        this.history.set(historyVersion, this.confirmedChanges);
        this.confirmedChanges = new Stack();
        this.removeExpiredHistory();
        this.allTrackingEntities.clear();
        this.minVersion = this.minVersion === -1 ? historyVersion : this.minVersion;
        this.currentVersion = historyVersion;
        if (this.log.traceEnabled) {
            this.log.trace(`SUCCESS acceptChanges Version=${historyVersion}`);
        }
    }

    private buildCreateChanges<T extends object>(schema: ModelSchema<T>, entity: TrackingEntity<T>): EntityChanges<Entity> {
        const changes: PropertyChange<Entity>[] = [];
        for (const prop in entity) {
            if (schema.isValidProperty(prop)) {
                changes.push({
                    name: prop,
                    current: entity[prop as keyof TrackingEntity<T>]
                });
            }
        }

        return {
            type: EntityChangeType.New,
            model: schema.modelName,
            primaryKey: schema.getNormalizedPrimaryKey(entity),
            dbVersion: 1,
            propertyChanges: changes
        };
    }

    private buildModifyChanges<T extends object>(schema: ModelSchema<T>, key: TrackingEntity<T>, values: PropertyValue<T>[], newVersion: number): EntityChanges<Entity> {
        const changes: PropertyChange<Entity>[] = [];
        values.forEach(value => {
            changes.push({
                name: astype<Property<T>>(value.name),
                current: value.value,
                original: key[value.name]
            });
        });
        changes.push({
            name: ENTITY_VERSION_PROPERTY,
            current: newVersion,
            original: newVersion - 1
        });

        return {
            type: EntityChangeType.Modify,
            model: schema.modelName,
            primaryKey: schema.getNormalizedPrimaryKey(key),
            dbVersion: newVersion,
            propertyChanges: changes
        };
    }

    private buildDeleteChanges<T extends object>(schema: ModelSchema<T>, key: TrackingEntity<T>, version: number): EntityChanges<Entity> {
        const changes: PropertyChange<Entity>[] = [];
        for (let prop in key) {
            if (schema.isValidProperty(prop)) {
                changes.push({
                    name: prop,
                    original: key[prop as keyof TrackingEntity<T>]
                });
            }
        }

        return {
            type: EntityChangeType.Delete,
            model: schema.modelName,
            primaryKey: schema.getNormalizedPrimaryKey(key),
            dbVersion: 1,
            propertyChanges: changes
        };
    }

    private undoEntityChanges(ec: EntityChanges<Entity>): void {
        switch (ec.type) {
            case EntityChangeType.New: {
                if (this.cache.get(ec.model, ec.primaryKey) !== undefined) {
                    this.cache.evit(ec.model, ec.primaryKey);
                }
                break;
            }

            case EntityChangeType.Modify: {
                const mapResult: PropertyValue<Entity>[] = ec.propertyChanges.map(value => ({
                    name: value.name,
                    value: value.original
                }));
                this.cache.refreshCached(ec.model, ec.primaryKey, mapResult);
                break;
            }

            case EntityChangeType.Delete: {
                const propertyChanges = makeJsonObject(ec.propertyChanges, key => key.name, value => value.original);
                const delSchema = this.schemas.get(ec.model);
                const delEntity = this.buildTrackingEntity<Entity>(delSchema!, propertyChanges as any, EntityState.Persistent);
                this.trackPersistent(delSchema!, delEntity);
                break;
            }
        }
    }

    private undoChanges(entityChanges: Stack<ChangesHistoryItem<Entity>>) {
        let iter: EntityChanges<Entity> | undefined;
        while ((iter = entityChanges.pop()) !== undefined) {
            this.undoEntityChanges(iter);
        }
    }

    rejectChanges(): void {
        this.cancelConfirm();
        this.undoChanges(this.confirmedChanges);
    }

    async rollbackChanges(historyVersion: number): Promise<void> {
        if (historyVersion > this.currentVersion) {
            return;
        }

        const holdVersion = this.currentVersion;
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN rollbackChanges Version : ${holdVersion}`);
        }
        await this.loadHistoryUntil(historyVersion);
        while (this.currentVersion >= historyVersion) {
            const hversion = this.getHistoryByVersion(this.currentVersion);
            this.undoChanges(hversion!);
            this.currentVersion--;
        }
        this.minVersion = Math.min(this.minVersion, this.currentVersion);
        if (this.log.traceEnabled) {
            this.log.trace(`SUCCESS rollbackChanges Version: ${holdVersion}->${this.currentVersion}`);
        }
    }

    get isConfirming(): boolean {
        return this.confirming;
    }

    beginConfirm(): void {
        this.confirming = true;
        if (this.unconfirmedChanges.length > 0 && this.log.warnEnabled) {
            this.log.warn(`unconfirmed changes(${this.unconfirmedChanges.length}) detected, you should call commit or cancel changes`);
        }
        this.unconfirmedChanges = new Stack();
        if (this.log.traceEnabled) {
            this.log.trace("BEGIN beginConfirm");
        }
    }

    confirm(): void {
        this.confirmedChanges.push(...this.unconfirmedChanges);
        this.unconfirmedChanges = new Stack();
        this.confirming = false;
        if (this.log.traceEnabled) {
            this.log.trace("SUCCESS confirm");
        }
    }

    cancelConfirm(): void {
        this.undoChanges(this.unconfirmedChanges);
        this.confirming = false;
        if (this.log.traceEnabled) {
            this.log.trace("SUCCESS cancelConfirm");
        }
    }

    private getHistoryByVersion(historyVersin: number, setIfNotExists: boolean = false): MaybeUndefined<Stack<ChangesHistoryItem<Entity>>> {
        if (!this.history.get(historyVersin) && setIfNotExists) {
            this.history.set(historyVersin, new Stack());
        }
        return this.history.get(historyVersin);
    }

    private async loadHistoryUntil(version: number): Promise<void> {
        if (version < this.minVersion) {
            const history = await this.loadHistory(version, this.minVersion);
            this.attachHistory(history);
        }
    }

    private removeExpiredHistory(): void {
        if (this.currentVersion - this.minVersion > this.maxHistoryVersionsHold) {
            this.clearHistoryBefore(this.currentVersion - this.maxHistoryVersionsHold);
        }
    }

    async getChangesUntil(historyVersion: number): Promise<Stack<EntityChanges<Entity>>> {
        await this.loadHistoryUntil(historyVersion);
        const changes: Stack<ChangesHistoryItem<Entity>> = [];
        while (historyVersion < this.currentVersion) {
            const history = this.getHistoryByVersion(historyVersion);
            if (history !== undefined) {
                changes.push(...history);
            }
        }
        return changes;
    }

    private clearHistoryBefore(version: number): void {
        if (!(this.minVersion >= version || this.currentVersion < version)) {
            for (let i = this.minVersion; i < version; i++) {
                this.history.delete(i);
            }
            this.minVersion = version;
        }
    }
}
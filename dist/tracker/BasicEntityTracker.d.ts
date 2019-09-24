import { MaybeUndefined, Entity, Nullable } from "../Common";
import { PrimaryKey, EntityKey, ModelSchema } from "../Model";
import { Logger } from "../Log";
import { EntityTracker, TrackingEntity, ModelAndKey, EntityChanges, Versioned, ChangesHistoryItem } from "./EntityTracker";
import { EntityCache } from "../cache/EntityCache";
export declare type LoadChangesHistoryAction = (fromVersion: number, toVersion: number) => Promise<Map<number, ChangesHistoryItem<Entity>[]>>;
export declare type Stack<T> = Array<T>;
export declare const Stack: ArrayConstructor;
export declare class BasicEntityTracker implements EntityTracker {
    private cache;
    private schemas;
    private maxHistoryVersionsHold;
    private log;
    private doLoadHistory?;
    private confirming;
    private minVersion;
    private currentVersion;
    private history;
    private allTrackingEntities;
    private confirmedChanges;
    private unconfirmedChanges;
    constructor(cache: EntityCache, schemas: Map<string, ModelSchema<Entity>>, maxHistoryVersionsHold: number, log: Logger, doLoadHistory?: Nullable<LoadChangesHistoryAction>);
    initVersion(version: number): Promise<void>;
    makeModelAndKey<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): ModelAndKey;
    splitModelAndKey<T extends object>(modelAndKey: ModelAndKey): {
        model: string;
        key: PrimaryKey<T>;
    };
    readonly trackingEntities: Iterable<TrackingEntity<Entity>>;
    isTracking<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): boolean;
    getConfirmedChanges(): EntityChanges<Entity>[];
    trackNew<T extends object>(schema: ModelSchema<T>, entity: T): TrackingEntity<T>;
    trackPersistent<T extends object>(schema: ModelSchema<T>, entity: Versioned<T>): TrackingEntity<T>;
    trackDelete<T extends object>(schema: ModelSchema<T>, te: TrackingEntity<T>): void;
    trackModify<T extends object>(schema: ModelSchema<T>, te: TrackingEntity<T>, modifier: Partial<T>): void;
    getTrackingEntity<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<TrackingEntity<T>>;
    acceptChanges(historyVersion: number): void;
    rejectChanges(): void;
    rollbackChanges(historyVersion: number): Promise<void>;
    readonly isConfirming: boolean;
    beginConfirm(): void;
    confirm(): void;
    cancelConfirm(): void;
    getChangesUntil(historyVersion: number): Promise<Stack<EntityChanges<Entity>>>;
    private loadHistory;
    private attachHistory;
    private readonly historyVersion;
    private readonly changesStack;
    private buildTrackingEntity;
    private ensureNotracking;
    private getTracking;
    private buildCreateChanges;
    private buildModifyChanges;
    private buildDeleteChanges;
    private undoEntityChanges;
    private undoChanges;
    private getHistoryByVersion;
    private loadHistoryUntil;
    private removeExpiredHistory;
    private clearHistoryBefore;
}

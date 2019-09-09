import { Minix, Property, MaybeUndefined, Entity } from "../Common";
import { ModelSchema, NormalizedEntityKey, EntityKey } from "../Model";

export enum EntityState {
    Transient = -1,
    Persistent = 0,
    New = 1,
    Modified = 2,
    Deleted = 3
}

export const ENTITY_VERSION_PROPERTY = "_version_";
export const ENTITY_EXTENSION_SYMBOL = "__extension__";
export type Versioned<T extends object> = Minix<T, {
    "_version_": number;
}>;

export enum EntityChangeType {
    New = 1,
    Modify = 2,
    Delete = 3
};

export interface PropertyChange<T extends object> {
    name: string & ((keyof T) | "_version_");
    original?: any;
    current?: any;
}

export interface PropertyValue<T extends object> {
    name: Property<T>;
    value: any;
}

export interface EntityChanges<T extends object> {
    type: EntityChangeType;
    dbVersion: number;
    model: string;
    primaryKey: NormalizedEntityKey<T>;
    propertyChanges: PropertyChange<T>[];
}

export type ModelAndKey = string;
export type ChangesHistoryItem<T extends object> = EntityChanges<T>;
export type TrackingEntityChangesItem<T extends object> = EntityChanges<T>;
export type TrackingEntity<T extends object> = Versioned<T>;

export interface EntityTracker {
    trackNew<T extends object>(schema: ModelSchema<T>, entity: T): TrackingEntity<T>;
    trackPersistent<T extends object>(schema: ModelSchema<T>, entityWithVersion: Versioned<T>): TrackingEntity<T>;
    trackModify<T extends object>(schema: ModelSchema<T>, te: TrackingEntity<T>, modifier: Partial<T>): void;
    trackDelete<T extends object>(schema: ModelSchema<T>, te: TrackingEntity<T>): void;

    acceptChanges(historyVersion: number): void;
    rejectChanges(): void;
    rollbackChanges(historyVersion: number): Promise<void>;
    getConfirmedChanges(): EntityChanges<Entity>[];

    isTracking<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): boolean;
    getTrackingEntity<T extends object>(schema: ModelSchema<T>, key: EntityKey<T>): MaybeUndefined<TrackingEntity<T>>;

    isConfirming: boolean;
    beginConfirm(): void;
    confirm(): void;
    cancelConfirm(): void;
}
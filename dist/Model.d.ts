import { JsonObject, Partial, Property, Entity, MaybeUndefined } from "./Common";
import { Versioned } from "./tracker/EntityTracker";
export declare type Constructor<T> = {
    new (): T;
};
export declare type ModelNameOrType<T> = string | Constructor<T>;
export declare type SimpleKey = string | number;
export declare type UniqueKey<T> = Partial<T>;
export declare type CompositeKey<T> = UniqueKey<T>;
export declare type PrimaryKey<T> = SimpleKey | CompositeKey<T>;
export declare type EntityKey<T> = PrimaryKey<T> | UniqueKey<T> | NormalizedEntityKey<T>;
export declare type NormalizedEntityKey<T> = UniqueKey<T>;
export declare type ResolvedEntityKey<T> = {
    isPrimaryKey?: boolean;
    isUniqueKey?: boolean;
    uniqueName: string;
    key: NormalizedEntityKey<T>;
};
export declare type EntityUnique<T> = {
    primaryKey?: UniqueKey<T>;
    uniqueKey?: UniqueKey<T>;
};
export declare type DbRecord = JsonObject;
export declare enum FieldTypes {
    String = "String",
    Number = "Number",
    BigInt = "BigInt",
    Text = "Text",
    JSON = "Json"
}
export declare type FieldType = string | FieldTypes;
export declare type ModelIndex<T> = {
    name: string;
    properties: Property<T>[];
};
export declare type DbIndex = {
    name: string;
    fields: string[];
};
export interface Field {
    name: string;
    type: FieldType;
    length?: number;
    index?: boolean | string;
    unique?: boolean | string;
    not_null?: boolean;
    primary_key?: boolean;
    composite_key?: boolean;
    default?: number | string | null;
}
export interface ForeignKey {
    field: string;
    table: string;
    table_field: string;
}
export interface Schema {
    table?: string;
    memory?: boolean;
    maxCached?: number;
    readonly?: boolean;
    local?: boolean;
    tableFields: Field[];
    foreignKeys?: ForeignKey[];
}
export declare class InvalidEntityKeyError extends Error {
    constructor(modelName: string, key: EntityKey<Entity>);
}
export declare class ModelSchema<T extends object> {
    static PRIMARY_KEY_NAME: string;
    private schema;
    private name;
    private memory;
    private readonly;
    private local;
    private maxCachedCount;
    private propertiesSet;
    private uniquePropertiesSet;
    private allPropertyTypes?;
    private primaryKeyProperty;
    private compositeKeyProperties?;
    private allProperties?;
    private allJsonProperties?;
    private allNormalIndexes?;
    private allUniqueIndexes?;
    constructor(schema: Schema, name: string);
    readonly properties: Property<T>[];
    readonly jsonProperties: Property<T>[];
    readonly schemaObject: Schema;
    readonly isCompsiteKey: boolean;
    readonly primaryKey: MaybeUndefined<Property<T>>;
    readonly compositeKeys: Property<T>[];
    readonly indexes: ModelIndex<T>[];
    readonly uniqueIndexes: ModelIndex<T>[];
    readonly maxCached: MaybeUndefined<number>;
    readonly modelName: string;
    readonly isLocal: boolean;
    readonly isReadonly: boolean;
    readonly memCached: boolean;
    hasUniqueProperty(...properties: string[]): boolean;
    isValidProperty(name: string): boolean;
    isValidEntityKey(key: EntityKey<T>): boolean;
    setPrimaryKey(entity: Partial<T>, key: PrimaryKey<T>): Partial<T>;
    getPrimaryKey(entity: Partial<T>): PrimaryKey<T>;
    getNormalizedPrimaryKey(entity: Partial<T>): NormalizedEntityKey<T>;
    normalizePrimaryKey(key: PrimaryKey<T>): NormalizedEntityKey<T>;
    isValidPrimaryKey(key: PrimaryKey<T>): boolean;
    isValidUniqueKey(key: UniqueKey<T>): boolean;
    isPrimaryKeyUniqueName(indexName: string): boolean;
    getUniqueIndex(indexName: string): MaybeUndefined<ModelIndex<T>>;
    resolveKey(key: EntityKey<T>): MaybeUndefined<ResolvedEntityKey<T>>;
    copyProperties(entity: Partial<T>, includePrimaryKey?: boolean): Partial<T>;
    setDefaultValues(entity: T): void;
    splitEntityAndVersion(entityWithVersion: Versioned<T>): {
        version: number;
        entity: T;
    };
    private isNormalizedPrimaryKey;
    private getUniqueName;
    private convertType;
    private attachVersionField;
    private parseProperties;
    private parseNormalIndexes;
    private parseUniqueIndexes;
    private getIndexes;
}

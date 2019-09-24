import { JsonObject, Partial, Property, Entity, MaybeUndefined, isPrimitiveKey, partialCopy } from "./Common";
import { Utils } from "./Utils";
import { ENTITY_VERSION_PROPERTY, Versioned } from "./tracker/EntityTracker";

export type Constructor<T> = {
    new(): T;
}

export type ModelNameOrType<T> = string | Constructor<T>;
export type SimpleKey = string | number;
export type UniqueKey<T> = Partial<T>;
export type CompositeKey<T> = UniqueKey<T>;
export type PrimaryKey<T> = SimpleKey | CompositeKey<T>;
export type EntityKey<T> = PrimaryKey<T> | UniqueKey<T> | NormalizedEntityKey<T>;
export type NormalizedEntityKey<T> = UniqueKey<T>;

export type ResolvedEntityKey<T> = {
    isPrimaryKey?: boolean;
    isUniqueKey?: boolean;
    uniqueName: string;
    key: NormalizedEntityKey<T>;
}

export type EntityUnique<T> = {
    primaryKey?: UniqueKey<T>;
    uniqueKey?: UniqueKey<T>;
}

export type DbRecord = JsonObject;

export enum FieldTypes {
    String = "String",
    Number = "Number",
    BigInt = "BigInt",
    Text = "Text",
    JSON = "Json",
}

export type FieldType = string | FieldTypes;

export type ModelIndex<T> = {
    name: string;
    properties: Property<T>[];
}

export type DbIndex = {
    name: string;
    fields: string[];
}

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

export class InvalidEntityKeyError extends Error {
    constructor(modelName: string, key: EntityKey<Entity>) {
        super(`Invalid entity key,(model=${modelName},key='${JSON.stringify(key)}')`);
    }
}

export class ModelSchema<T extends object> {
    static PRIMARY_KEY_NAME = "__PrimaryKey__";

    private schema: Schema;
    private name: string;
    private memory: boolean;
    private readonly: boolean;
    private local: boolean;
    private maxCachedCount: number;

    private propertiesSet: Set<string>;
    private uniquePropertiesSet: Set<Property<string>>;
    private allPropertyTypes?: Map<string, FieldType>;

    private primaryKeyProperty: MaybeUndefined<string>;
    private compositeKeyProperties?: Array<String>;
    private allProperties?: Array<string>;
    private allJsonProperties?: Array<string>;
    private allNormalIndexes?: Array<ModelIndex<string>>;
    private allUniqueIndexes?: Array<ModelIndex<string>>;

    constructor(schema: Schema, name: string) {
        this.schema = Utils.Lang.cloneDeep(schema);
        this.name = name;
        this.memory = schema.memory === !0;
        this.readonly = schema.readonly === !0;
        this.local = schema.local === !0;
        this.maxCachedCount = this.memory ? Number.POSITIVE_INFINITY : schema.maxCached!;

        this.propertiesSet = new Set();
        this.uniquePropertiesSet = new Set();

        this.attachVersionField();
        this.parseProperties();
    }

    // /> getters
    get properties(): Property<T>[] {
        return this.allProperties! as any;
    }

    get jsonProperties(): Property<T>[] {
        return this.allJsonProperties! as any;
    }

    get schemaObject(): Schema {
        return this.schema;
    }

    get isCompsiteKey(): boolean {
        return this.compositeKeys.length > 1;
    }

    get primaryKey(): MaybeUndefined<Property<T>> {
        return this.primaryKeyProperty as any;
    }

    get compositeKeys(): Property<T>[] {
        return this.compositeKeyProperties! as any;
    }

    get indexes(): ModelIndex<T>[] {
        return this.allNormalIndexes! as any;
    }

    get uniqueIndexes(): ModelIndex<T>[] {
        return this.allUniqueIndexes! as any;
    }

    get maxCached(): MaybeUndefined<number> {
        return this.maxCachedCount;
    }

    get modelName(): string {
        return this.name;
    }

    get isLocal(): boolean {
        return this.local;
    }

    get isReadonly(): boolean {
        return this.readonly;
    }

    get memCached(): boolean {
        return this.memory;
    }

    // /> public methods
    hasUniqueProperty(...properties: string[]): boolean {
        return properties.some(value => this.uniquePropertiesSet.has(value as any));
    }

    isValidProperty(name: string): boolean {
        return this.propertiesSet.has(name);
    }

    isValidEntityKey(key: EntityKey<T>): boolean {
        return this.isValidPrimaryKey(key) || this.isValidUniqueKey(key as UniqueKey<T>);
    }

    setPrimaryKey(entity: Partial<T>, key: PrimaryKey<T>): Partial<T> {
        if (!this.isValidPrimaryKey(key)) {
            throw new Error(`Invalid PrimaryKey of model '${this.modelName}', key=''${JSON.stringify(key)}`);
        }
        if (!this.isCompsiteKey && isPrimitiveKey(key)) {
            entity[this.primaryKey as keyof T] = key as T[keyof T];
        } else {
            if (this.isCompsiteKey) {
                partialCopy<Partial<T>>(key as Partial<T>, this.compositeKeys, entity);
            } else {
                partialCopy<Partial<T>>(key as Partial<T>, [this.primaryKey!], entity)
            }
        }
        return entity;
    }

    getPrimaryKey(entity: Partial<T>): PrimaryKey<T> {
        if (this.isCompsiteKey) {
            return partialCopy(entity, this.compositeKeys) as any;
        } else {
            return entity[this.primaryKey as keyof T]!;
        }
    }

    getNormalizedPrimaryKey(entity: Partial<T>): NormalizedEntityKey<T> {
        if (this.isCompsiteKey) {
            return partialCopy(entity, this.compositeKeys) as any;
        } else {
            return partialCopy(entity, [this.primaryKey!]) as any;
        }
    }

    normalizePrimaryKey(key: PrimaryKey<T>): NormalizedEntityKey<T> {
        if (!isPrimitiveKey(key)) {
            return key as CompositeKey<T>;
        }

        const result: NormalizedEntityKey<T> = {};
        result[this.primaryKey as keyof T] = key as T[keyof T];
        return result;
    }

    isValidPrimaryKey(key: PrimaryKey<T>): boolean {
        return !this.isCompsiteKey
            && (isPrimitiveKey(key) || this.isNormalizedPrimaryKey(key))
            || Utils.Array.xor(Object.keys(key), this.compositeKeys).length === 0;
    }

    isValidUniqueKey(key: UniqueKey<T>): boolean {
        return this.getUniqueName(key) !== undefined;
    }

    isPrimaryKeyUniqueName(indexName: string): boolean {
        return indexName === ModelSchema.PRIMARY_KEY_NAME;
    }

    getUniqueIndex(indexName: string): MaybeUndefined<ModelIndex<T>> {
        return this.allUniqueIndexes!.find(value => value.name === indexName) as any;
    }

    resolveKey(key: EntityKey<T>): MaybeUndefined<ResolvedEntityKey<T>> {
        const uniqueName = this.getUniqueName(key);
        if (uniqueName === undefined) return uniqueName;

        if (this.isPrimaryKeyUniqueName(uniqueName)) {
            return {
                key: this.setPrimaryKey({}, key),
                uniqueName,
                isPrimaryKey: true
            }
        }
        return {
            key: key as Partial<T>,
            uniqueName,
            isUniqueKey: true
        };
    }

    copyProperties(entity: Partial<T>, includePrimaryKey: boolean = true): Partial<T> {
        if (entity) {
            return partialCopy(entity, includePrimaryKey
                ? this.allProperties!
                : key => this.allProperties!.includes(key)) as any;
        }

        return entity;
    }

    setDefaultValues(entity: T): void {
        this.schema.tableFields.forEach(value => {
            if (value.default !== undefined && (entity[value.name as keyof T] === null || entity[value.name as keyof T] === undefined)) {
                entity[value.name as keyof T] = value.default as any;
            }
        });
    }

    splitEntityAndVersion(entityWithVersion: Versioned<T>): { version: number; entity: T } {
        const t = entityWithVersion[ModelSchema.PRIMARY_KEY_NAME as keyof Versioned<T>] as number;

        Reflect.deleteProperty(entityWithVersion, ModelSchema.PRIMARY_KEY_NAME);
        return {
            version: t,
            entity: entityWithVersion
        };
    }

    ////
    private isNormalizedPrimaryKey(key: PrimaryKey<T>): boolean {
        if (!Utils.Lang.isObject(key)) {
            return false;
        }

        if (this.isCompsiteKey) {
            return this.isValidPrimaryKey(key);
        }
        const keys = Object.keys(key);
        return keys.length === 1 && keys[0] === this.primaryKey;
    }

    private getUniqueName(name: EntityKey<T>): MaybeUndefined<string> {
        if (this.isValidPrimaryKey(name)) {
            return ModelSchema.PRIMARY_KEY_NAME;
        }

        const keys = Object.keys(name as Partial<T>);
        if (keys.length === 1 && keys[0] === this.primaryKey) {
            return ModelSchema.PRIMARY_KEY_NAME;
        }
        const findValue = this.uniqueIndexes
            .find(value => Utils.Array.xor(value.properties, keys).length === 0);
        return findValue === undefined ? undefined : findValue.name;
    }

    private convertType<T>(e: T): T {
        return e;
    }

    private attachVersionField(): void {
        if (!this.schema.tableFields
            .some(val => val.name === ENTITY_VERSION_PROPERTY)) {
            this.schema.tableFields
                .push({
                    name: "_version_",
                    type: FieldTypes.Number,
                    default: 0
                });
        }
    }

    private parseProperties(): void {
        const primaryField: string[] = this.schema.tableFields
            .filter(value => value.primary_key === !0)
            .map(value => value.name);

        this.compositeKeyProperties = this.schema.tableFields
            .filter(value => value.composite_key === !0)
            .map(value => value.name);
        this.primaryKeyProperty = primaryField.length === 1 ? primaryField[0] : undefined;
        if (!(void 0 !== this.primaryKeyProperty != this.compositeKeyProperties.length > 1)) {
            throw new Error("model must have primary key or composite keys, but can not both");
        }

        this.allPropertyTypes = new Map();
        this.schema.tableFields
            .forEach(value => this.allPropertyTypes!.set(value.name, this.convertType(value.type)));

        this.allProperties = this.schema.tableFields
            .map(value => value.name);
        this.allJsonProperties = this.schema.tableFields
            .filter(value => value.type == FieldTypes.JSON)
            .map(value => value.name);
        this.allProperties
            .forEach(value => this.propertiesSet.add(value));

        this.allNormalIndexes = this.parseNormalIndexes(this.schema);
        this.allUniqueIndexes = this.parseUniqueIndexes(this.schema);
        this.allProperties
            .forEach(val => this.propertiesSet.add(val));
        this.allUniqueIndexes!
            .forEach(val => val.properties.forEach(val => this.uniquePropertiesSet.add(val)));
    }

    private parseNormalIndexes(schema: Schema): ModelIndex<string>[] {
        return this.getIndexes(schema.tableFields, "index");
    }

    private parseUniqueIndexes(schema: Schema): ModelIndex<string>[] {
        return this.getIndexes(schema.tableFields, "unique");
    }

    private getIndexes(fields: Field[], fieldName: keyof Field): ModelIndex<string>[] {
        const filterResult: Map<string, string[]> = new Map();
        fields
            .filter(value => value[fieldName] !== undefined)
            .forEach(value => {
                const item = value[fieldName];
                if (typeof item !== "boolean" && typeof item !== "string") {
                    throw new Error("index or unique should be true or a valid name");
                }

                const name = value.name;
                if (typeof item === "boolean" && item === true) {
                    filterResult.set(value.name, [name]);
                } else if (typeof item === "string") {
                    if (!filterResult.has(item)) {
                        filterResult.set(item, []);
                    }
                    filterResult.get(item)!.push(name);
                }
            });
        return [...filterResult.keys()]
            .map(value => ({
                name: value,
                properties: filterResult.get(value)! as Property<string>[]
            }));
    }
}
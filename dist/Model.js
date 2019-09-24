"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Common_1 = require("./Common");
const Utils_1 = require("./Utils");
const EntityTracker_1 = require("./tracker/EntityTracker");
var FieldTypes;
(function (FieldTypes) {
    FieldTypes["String"] = "String";
    FieldTypes["Number"] = "Number";
    FieldTypes["BigInt"] = "BigInt";
    FieldTypes["Text"] = "Text";
    FieldTypes["JSON"] = "Json";
})(FieldTypes = exports.FieldTypes || (exports.FieldTypes = {}));
class InvalidEntityKeyError extends Error {
    constructor(modelName, key) {
        super(`Invalid entity key,(model=${modelName},key='${JSON.stringify(key)}')`);
    }
}
exports.InvalidEntityKeyError = InvalidEntityKeyError;
class ModelSchema {
    constructor(schema, name) {
        this.schema = Utils_1.Utils.Lang.cloneDeep(schema);
        this.name = name;
        this.memory = schema.memory === !0;
        this.readonly = schema.readonly === !0;
        this.local = schema.local === !0;
        this.maxCachedCount = this.memory ? Number.POSITIVE_INFINITY : schema.maxCached;
        this.propertiesSet = new Set();
        this.uniquePropertiesSet = new Set();
        this.attachVersionField();
        this.parseProperties();
    }
    // /> getters
    get properties() {
        return this.allProperties;
    }
    get jsonProperties() {
        return this.allJsonProperties;
    }
    get schemaObject() {
        return this.schema;
    }
    get isCompsiteKey() {
        return this.compositeKeys.length > 1;
    }
    get primaryKey() {
        return this.primaryKeyProperty;
    }
    get compositeKeys() {
        return this.compositeKeyProperties;
    }
    get indexes() {
        return this.allNormalIndexes;
    }
    get uniqueIndexes() {
        return this.allUniqueIndexes;
    }
    get maxCached() {
        return this.maxCachedCount;
    }
    get modelName() {
        return this.name;
    }
    get isLocal() {
        return this.local;
    }
    get isReadonly() {
        return this.readonly;
    }
    get memCached() {
        return this.memory;
    }
    // /> public methods
    hasUniqueProperty(...properties) {
        return properties.some(value => this.uniquePropertiesSet.has(value));
    }
    isValidProperty(name) {
        return this.propertiesSet.has(name);
    }
    isValidEntityKey(key) {
        return this.isValidPrimaryKey(key) || this.isValidUniqueKey(key);
    }
    setPrimaryKey(entity, key) {
        if (!this.isValidPrimaryKey(key)) {
            throw new Error(`Invalid PrimaryKey of model '${this.modelName}', key=''${JSON.stringify(key)}`);
        }
        if (!this.isCompsiteKey && Common_1.isPrimitiveKey(key)) {
            entity[this.primaryKey] = key;
        }
        else {
            if (this.isCompsiteKey) {
                Common_1.partialCopy(key, this.compositeKeys, entity);
            }
            else {
                Common_1.partialCopy(key, [this.primaryKey], entity);
            }
        }
        return entity;
    }
    getPrimaryKey(entity) {
        if (this.isCompsiteKey) {
            return Common_1.partialCopy(entity, this.compositeKeys);
        }
        else {
            return entity[this.primaryKey];
        }
    }
    getNormalizedPrimaryKey(entity) {
        if (this.isCompsiteKey) {
            return Common_1.partialCopy(entity, this.compositeKeys);
        }
        else {
            return Common_1.partialCopy(entity, [this.primaryKey]);
        }
    }
    normalizePrimaryKey(key) {
        if (!Common_1.isPrimitiveKey(key)) {
            return key;
        }
        const result = {};
        result[this.primaryKey] = key;
        return result;
    }
    isValidPrimaryKey(key) {
        return !this.isCompsiteKey
            && (Common_1.isPrimitiveKey(key) || this.isNormalizedPrimaryKey(key))
            || Utils_1.Utils.Array.xor(Object.keys(key), this.compositeKeys).length === 0;
    }
    isValidUniqueKey(key) {
        return this.getUniqueName(key) !== undefined;
    }
    isPrimaryKeyUniqueName(indexName) {
        return indexName === ModelSchema.PRIMARY_KEY_NAME;
    }
    getUniqueIndex(indexName) {
        return this.allUniqueIndexes.find(value => value.name === indexName);
    }
    resolveKey(key) {
        const uniqueName = this.getUniqueName(key);
        if (uniqueName === undefined)
            return uniqueName;
        if (this.isPrimaryKeyUniqueName(uniqueName)) {
            return {
                key: this.setPrimaryKey({}, key),
                uniqueName,
                isPrimaryKey: true
            };
        }
        return {
            key: key,
            uniqueName,
            isUniqueKey: true
        };
    }
    copyProperties(entity, includePrimaryKey = true) {
        if (entity) {
            return Common_1.partialCopy(entity, includePrimaryKey
                ? this.allProperties
                : key => this.allProperties.includes(key));
        }
        return entity;
    }
    setDefaultValues(entity) {
        this.schema.tableFields.forEach(value => {
            if (value.default !== undefined && (entity[value.name] === null || entity[value.name] === undefined)) {
                entity[value.name] = value.default;
            }
        });
    }
    splitEntityAndVersion(entityWithVersion) {
        const t = entityWithVersion[ModelSchema.PRIMARY_KEY_NAME];
        Reflect.deleteProperty(entityWithVersion, ModelSchema.PRIMARY_KEY_NAME);
        return {
            version: t,
            entity: entityWithVersion
        };
    }
    ////
    isNormalizedPrimaryKey(key) {
        if (!Utils_1.Utils.Lang.isObject(key)) {
            return false;
        }
        if (this.isCompsiteKey) {
            return this.isValidPrimaryKey(key);
        }
        const keys = Object.keys(key);
        return keys.length === 1 && keys[0] === this.primaryKey;
    }
    getUniqueName(name) {
        if (this.isValidPrimaryKey(name)) {
            return ModelSchema.PRIMARY_KEY_NAME;
        }
        const keys = Object.keys(name);
        if (keys.length === 1 && keys[0] === this.primaryKey) {
            return ModelSchema.PRIMARY_KEY_NAME;
        }
        const findValue = this.uniqueIndexes
            .find(value => Utils_1.Utils.Array.xor(value.properties, keys).length === 0);
        return findValue === undefined ? undefined : findValue.name;
    }
    convertType(e) {
        return e;
    }
    attachVersionField() {
        if (!this.schema.tableFields
            .some(val => val.name === EntityTracker_1.ENTITY_VERSION_PROPERTY)) {
            this.schema.tableFields
                .push({
                name: "_version_",
                type: FieldTypes.Number,
                default: 0
            });
        }
    }
    parseProperties() {
        const primaryField = this.schema.tableFields
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
            .forEach(value => this.allPropertyTypes.set(value.name, this.convertType(value.type)));
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
        this.allUniqueIndexes
            .forEach(val => val.properties.forEach(val => this.uniquePropertiesSet.add(val)));
    }
    parseNormalIndexes(schema) {
        return this.getIndexes(schema.tableFields, "index");
    }
    parseUniqueIndexes(schema) {
        return this.getIndexes(schema.tableFields, "unique");
    }
    getIndexes(fields, fieldName) {
        const filterResult = new Map();
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
            }
            else if (typeof item === "string") {
                if (!filterResult.has(item)) {
                    filterResult.set(item, []);
                }
                filterResult.get(item).push(name);
            }
        });
        return [...filterResult.keys()]
            .map(value => ({
            name: value,
            properties: filterResult.get(value)
        }));
    }
}
exports.ModelSchema = ModelSchema;
ModelSchema.PRIMARY_KEY_NAME = "__PrimaryKey__";

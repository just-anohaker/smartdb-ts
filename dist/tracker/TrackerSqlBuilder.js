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
const EntityTracker_1 = require("./EntityTracker");
const Common_1 = require("../Common");
class BasicTrackerSqlBuilder {
    constructor(tracker, schemas, sqlBuilder) {
        this.tracker = tracker;
        this.schemas = schemas;
        this.sqlBuilder = sqlBuilder;
    }
    static fieldValuesFromChanges(entity, rollback = false) {
        return rollback
            ? Common_1.makeJsonObject(entity.propertyChanges, key => key.name, value => value.original)
            : Common_1.makeJsonObject(entity.propertyChanges, key => key.name, value => value.current);
    }
    get entityTracker() {
        return this.tracker;
    }
    buildChangeSqls() {
        return this.tracker.getConfirmedChanges()
            .map(value => this.buildSqlAndParameters(this.schemas.get(value.model), value.primaryKey, value));
    }
    buildRollbackChangeSqls(historyVersion) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = [];
            const changes = yield this.tracker.getChangesUntil(historyVersion);
            let iter = undefined;
            while ((iter = changes.pop()) !== undefined) {
                const schema = this.schemas.get(iter.model);
                result.push(this.buildRollbackSqlAndParameters(schema, iter.primaryKey, iter));
            }
            return result;
        });
    }
    buildSqlAndParameters(schema, key, entity) {
        const fieldValues = BasicTrackerSqlBuilder.fieldValuesFromChanges(entity);
        fieldValues[EntityTracker_1.ENTITY_VERSION_PROPERTY] = entity.dbVersion;
        switch (entity.type) {
            case EntityTracker_1.EntityChangeType.New:
                return this.sqlBuilder.buildInsert(schema, fieldValues);
            case EntityTracker_1.EntityChangeType.Modify:
                return this.sqlBuilder.buildUpdate(schema, key, fieldValues, entity.dbVersion - 1);
            case EntityTracker_1.EntityChangeType.Delete:
                return this.sqlBuilder.buildDelete(schema, key);
            default:
                throw new Error(`Invalid EntityChangeType '${entity.type}`);
        }
    }
    buildRollbackSqlAndParameters(schema, key, entity) {
        const fieldValues = BasicTrackerSqlBuilder.fieldValuesFromChanges(entity);
        switch (fieldValues.type) {
            case EntityTracker_1.EntityChangeType.New:
                return this.sqlBuilder.buildDelete(schema, key);
            case EntityTracker_1.EntityChangeType.Modify:
                fieldValues[EntityTracker_1.ENTITY_VERSION_PROPERTY] = entity.dbVersion - 1;
                this.sqlBuilder.buildUpdate(schema, key, fieldValues, entity.dbVersion);
            case EntityTracker_1.EntityChangeType.Delete:
                return this.sqlBuilder.buildInsert(schema, fieldValues);
            default:
                throw new Error(`Invalid EntityChangeType '${entity.type}`);
        }
    }
}
exports.BasicTrackerSqlBuilder = BasicTrackerSqlBuilder;

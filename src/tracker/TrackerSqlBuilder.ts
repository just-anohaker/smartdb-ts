import { SqlAndParameters, SqlBuilder } from "../sqldb/SqlBuilder";
import { BasicEntityTracker } from "./BasicEntityTracker";
import { ModelSchema, PrimaryKey } from "../Model";
import { EntityChangeType, EntityChanges, ENTITY_VERSION_PROPERTY } from "./EntityTracker";
import { makeJsonObject, Entity } from "../Common";

export interface TrackerSqlBuilder {
    buildChangeSqls(): SqlAndParameters[];
    buildRollbackChangeSqls(historyVersion: number): Promise<SqlAndParameters[]>;
}

export class BasicTrackerSqlBuilder implements TrackerSqlBuilder {
    static fieldValuesFromChanges(entity: EntityChanges<Entity>, rollback: boolean = false) {
        return rollback
            ? makeJsonObject(entity.propertyChanges, key => key.name, value => value.original)
            : makeJsonObject(entity.propertyChanges, key => key.name, value => value.current);
    }

    constructor(
        private tracker: BasicEntityTracker,
        private schemas: Map<string, ModelSchema<Entity>>,
        private sqlBuilder: SqlBuilder) { }

    get entityTracker(): BasicEntityTracker {
        return this.tracker;
    }

    buildChangeSqls(): SqlAndParameters[] {
        return this.tracker.getConfirmedChanges()
            .map(value => this.buildSqlAndParameters(this.schemas.get(value.model)!, value.primaryKey, value));
    }

    async buildRollbackChangeSqls(historyVersion: number): Promise<SqlAndParameters[]> {
        const result: SqlAndParameters[] = [];
        const changes = await this.tracker.getChangesUntil(historyVersion);
        let iter: EntityChanges<Entity> | undefined = undefined;
        while ((iter = changes.pop()) !== undefined) {
            const schema = this.schemas.get(iter.model);
            result.push(this.buildRollbackSqlAndParameters(schema!, iter.primaryKey, iter));
        }
        return result;
    }

    private buildSqlAndParameters(schema: ModelSchema<Entity>, key: PrimaryKey<Entity>, entity: EntityChanges<Entity>): SqlAndParameters {
        const fieldValues = BasicTrackerSqlBuilder.fieldValuesFromChanges(entity);
        fieldValues[ENTITY_VERSION_PROPERTY] = entity.dbVersion;
        switch (fieldValues.type) {
            case EntityChangeType.New: {
                return this.sqlBuilder.buildInsert(schema, fieldValues);
            }

            case EntityChangeType.Modify: {
                return this.sqlBuilder.buildUpdate(schema, key, fieldValues, entity.dbVersion - 1);
            }

            case EntityChangeType.Delete: {
                return this.sqlBuilder.buildDelete(schema, key);
            }

            default:
                throw new Error(`Invalid EntityChangeType '${entity.type}`);
        }
    }

    private buildRollbackSqlAndParameters(schema: ModelSchema<Entity>, key: PrimaryKey<Entity>, entity: EntityChanges<Entity>): SqlAndParameters {
        const fieldValues = BasicTrackerSqlBuilder.fieldValuesFromChanges(entity);
        switch (fieldValues.type) {
            case EntityChangeType.New: {
                return this.sqlBuilder.buildDelete(schema, key);
            }

            case EntityChangeType.Modify: {
                fieldValues[ENTITY_VERSION_PROPERTY] = entity.dbVersion - 1;
                this.sqlBuilder.buildUpdate(schema, key, fieldValues, entity.dbVersion);
            }

            case EntityChangeType.Delete: {
                return this.sqlBuilder.buildInsert(schema, fieldValues);
            }

            default:
                throw new Error(`Invalid EntityChangeType '${entity.type}`);
        }
    }

}
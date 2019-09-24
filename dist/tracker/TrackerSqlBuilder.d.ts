import { SqlAndParameters, SqlBuilder } from "../sqldb/SqlBuilder";
import { BasicEntityTracker } from "./BasicEntityTracker";
import { ModelSchema } from "../Model";
import { Entity } from "../Common";
export interface TrackerSqlBuilder {
    buildChangeSqls(): SqlAndParameters[];
    buildRollbackChangeSqls(historyVersion: number): Promise<SqlAndParameters[]>;
}
export declare class BasicTrackerSqlBuilder implements TrackerSqlBuilder {
    private tracker;
    private schemas;
    private sqlBuilder;
    private static fieldValuesFromChanges;
    constructor(tracker: BasicEntityTracker, schemas: Map<string, ModelSchema<Entity>>, sqlBuilder: SqlBuilder);
    readonly entityTracker: BasicEntityTracker;
    buildChangeSqls(): SqlAndParameters[];
    buildRollbackChangeSqls(historyVersion: number): Promise<SqlAndParameters[]>;
    private buildSqlAndParameters;
    private buildRollbackSqlAndParameters;
}

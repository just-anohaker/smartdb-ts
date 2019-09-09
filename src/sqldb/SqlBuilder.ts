import { JsonObject, ObjectLiteral, deepCopy, VerifyFunction } from "../Common";
import { SimpleKey, PrimaryKey, ModelSchema, Schema, FieldTypes } from "../Model";
import { Utils } from "../Utils";
import JsonSqlCtor = require("json-sql");
import { Versioned } from "../tracker/EntityTracker";
const JsonSql = JsonSqlCtor({ separatedValues: false });

export const MULTI_SQL_SEPARATOR = ";";

export enum SqlType {
    Schema = 0,
    Select = 1,
    Insert = 2,
    Update = 3,
    Delete = 4,
    Other = 5
}

export type SqlParameters = Array<any> | JsonObject;
export type SqlAndParameters = {
    type: SqlType;
    query: string;
    parameters?: SqlParameters;
    expectEffected?: boolean;
}

export type UnaryOperators = "$null" | "$is" | "$isnot";
export type BinaryOperators = "$eq" | "$ne" | "$gt" | "$lt" | "$gte" | "$lte" | "$like" | "$field" | "$in" | "$nin" | "$between";
export type RelationOperators = "$not" | "$and" | "$or";
export type SelectExpression = {
    select: {
        table: string;
        fields?: string[];
        where?: string;
        [key: string]: any;
    }
}

export type ValueExpression = SimpleKey;
export type FieldValueExpression = {
    [field: string]: SimpleKey;
}
export type FieldArrayValueExpression = {
    [field: string]: SimpleKey[];
}

export type NullCompareExpression = {
    $null: string;
} | {
        [oper in "$is" | "$isnot"]?: {
            [field: string]: null;
        };
    }

export type ValueCompareExpression = FieldValueExpression | {
    [field: string]: {
        [oper in "$eq" | "$ne" | "$gt" | "$lt" | "$gte" | "$lte"]?: ValueExpression | SelectExpression;
    };
}

export type ArrayCompareExpression = FieldArrayValueExpression | {
    [field: string]: {
        [oper in "$between" | "$in" | "$nin"]?: ValueExpression[] | SelectExpression;
    };
}

export type LikeExpression = {
    [key: string]: {
        $like: string;
    };
}

export type CompareExpression = ValueCompareExpression | ArrayCompareExpression | LikeExpression | NullCompareExpression;

export type RelationExpression = CompareExpression[] | {
    $not: CompareExpression | RelationExpression;
} | {
        [oper in "$and" | "$or"]?: CompareExpression[] | RelationExpression[];
    }

export type SqlCondition = CompareExpression | RelationExpression;
export type LimitAndOffset = {
    limit?: number;
    offset?: number;
}
export type SqlResultRange = number | LimitAndOffset;
export type SqlOrderItem = {
    [field: string]: "ASC" | "DESC" | 1 | -1;
}
export type SqlOrder = SqlOrderItem | SqlOrderItem[];

export interface SqlBuilder {
    buildDropSchema<T extends object>(schema: ModelSchema<T>): string;
    buildSchema<T extends object>(schema: ModelSchema<T>): string[];
    buildInsert<T extends object>(schema: ModelSchema<T>, fieldValues: JsonObject): SqlAndParameters;
    buildDelete<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): SqlAndParameters;
    buildUpdate<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>, fieldValues: JsonObject, version: number): SqlAndParameters;
    buildSelect<T extends object>(schema: ModelSchema<T>, params: JsonObject): SqlAndParameters;
    buildSelect<T extends object>(schema: ModelSchema<T>, fields: string[], where: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, join?: JsonObject): SqlAndParameters;
}

export class JsonSqlBuilder implements SqlBuilder {
    private getTableName(name: string): string {
        return Utils.String.snakeCase(name) + "s";
    }

    private replaceJsonFields<T extends object>(schema: ModelSchema<T>, fieldValues: JsonObject): JsonObject {
        if (schema.jsonProperties.length === 0) {
            return fieldValues;
        }

        let result = Object.assign({}, fieldValues);
        schema.jsonProperties.forEach(value => {
            if (Reflect.has(fieldValues, value)) {
                result[value] = JSON.stringify(fieldValues[value]);
            }
        });
        return result;
    }

    private getPrimaryKeyCondition<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): Partial<T> {
        return schema.setPrimaryKey({}, key);
    }

    buildDropSchema<T extends object>(schema: ModelSchema<T>): string {
        return `drop table "${this.getTableName(schema.modelName)}"`;
    }

    buildSchema<T extends object>(schema: ModelSchema<T>): string[] {
        let result: string[] = [];
        const sqlStatement: Schema = Object.assign({ type: "create" }, deepCopy(schema.schemaObject));
        schema.jsonProperties
            .forEach(value => {
                const findObj = sqlStatement.tableFields.find(val => val.name === value);
                if (findObj) {
                    findObj.type = FieldTypes.Text;
                }
            });
        sqlStatement.tableFields
            .filter(value => Utils.Lang.isString(value.unique))
            .forEach(value => Reflect.deleteProperty(value, "unique"));

        const jsonSqlBuilded = JsonSql.build(sqlStatement);
        result.push(jsonSqlBuilded.query);
        const tableName = this.getTableName(schema.modelName);
        schema.indexes.forEach(value => {
            result.push(JsonSql.build({
                type: "index",
                table: tableName,
                name: tableName + "_" + value.name,
                indexOn: value.properties.join(",")
            }).query);
        });
        const uniqueNames = sqlStatement.tableFields.filter(value => value.unique === true).map(value => value.name);
        const uniqueIndexs = schema.uniqueIndexes.filter(value => {
            return !(value.properties.length === 1 && uniqueNames.some(val => val === value.properties[0]));
        });
        if (schema.isCompsiteKey) {
            uniqueIndexs.push({ name: "composite_primary_key", properties: schema.compositeKeys });
        }
        uniqueIndexs.forEach(value => {
            result.push(JsonSql.build({
                type: "unique",
                table: tableName,
                name: tableName + "_" + value.name,
                uniqueOn: value.properties.join(",")
            }).query);
        });
        return result;
    }

    buildInsert<T extends object>(schema: ModelSchema<T>, fieldValues: JsonObject): SqlAndParameters {
        const result: SqlAndParameters = { type: SqlType.Insert, query: "" };
        return Object.assign(result, JsonSql.build({
            type: "insert",
            table: this.getTableName(schema.modelName),
            values: this.replaceJsonFields<T>(schema, fieldValues)
        }));
    }

    buildDelete<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): SqlAndParameters {
        const result: SqlAndParameters = { type: SqlType.Delete, query: "" };
        return Object.assign(result, JsonSql.build({
            type: "remove",
            table: this.getTableName(schema.modelName),
            values: this.getPrimaryKeyCondition<T>(schema, key)
        }));
    }

    buildUpdate<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>, fieldValues: JsonObject, version: number): SqlAndParameters {
        const tableName = this.getTableName(schema.modelName);
        const primaryKeyCond = this.getPrimaryKeyCondition(schema, key);
        (primaryKeyCond as Versioned<T>)._version_ = version;
        const result: SqlAndParameters = { type: SqlType.Update, query: "" };
        return Object.assign(result, JsonSql.build({
            type: "update",
            table: tableName,
            modifier: this.replaceJsonFields(schema, fieldValues),
            condition: primaryKeyCond
        }));
    }
    buildSelect<T extends object>(schema: ModelSchema<T>, params: string[] | JsonObject, where?: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, join?: JsonObject): SqlAndParameters {
        const tableName = this.getTableName(schema.modelName);
        let sqlStatement = {};
        if (Utils.Lang.isArray(params)) {
            const fields = params as string[] || schema.properties.map(value => schema.schemaObject.table + "." + value);
            const limit: LimitAndOffset = (Utils.Lang.isNumber(resultRange) ? { limit: resultRange as number } : (resultRange || {})) as LimitAndOffset;
            const sorted = sort || {};
            if (Utils.Lang.isArray(sorted)) {
                for (let sortedItem of sorted as SqlOrderItem[]) {
                    for (let sort of Reflect.ownKeys(sortedItem as SqlOrderItem)) {
                        const rule = sortedItem[sort as string | number] || -1;
                        sortedItem[sort as string | number] = "ASC" === rule ? 1 : ("DESC" === rule ? -1 : rule);
                    }
                }
            } else {
                for (let sort of Reflect.ownKeys(sorted as SqlOrderItem)) {
                    const rule = (sorted as SqlOrderItem)[sort as string | number] || -1;
                    (sorted as SqlOrderItem)[sort as string | number] = "ASC" === rule ? 1 : ("DESC" === rule ? -1 : rule);
                }
            }
            sqlStatement = {
                type: "select",
                table: tableName,
                fields: fields,
                condition: where,
                limit: limit.limit,
                offset: limit.offset,
                sort: sorted,
                join: join
            }
        } else {
            sqlStatement = Object.assign({ type: "select", table: tableName }, params as JsonObject);
        }
        const result: SqlAndParameters = { type: SqlType.Select, query: "" };
        return Object.assign(result, sqlStatement);
    }
}
import { JsonObject } from "../Common";
import { SimpleKey, PrimaryKey, ModelSchema } from "../Model";
export declare const MULTI_SQL_SEPARATOR = ";";
export declare enum SqlType {
    Schema = 0,
    Select = 1,
    Insert = 2,
    Update = 3,
    Delete = 4,
    Other = 9
}
export declare type SqlParameters = Array<any> | JsonObject;
export declare type SqlAndParameters = {
    type: SqlType;
    query: string;
    parameters?: SqlParameters;
    expectEffected?: boolean;
};
export declare type UnaryOperators = "$null" | "$is" | "$isnot";
export declare type BinaryOperators = "$eq" | "$ne" | "$gt" | "$lt" | "$gte" | "$lte" | "$like" | "$field" | "$in" | "$nin" | "$between";
export declare type RelationOperators = "$not" | "$and" | "$or";
export declare type SelectExpression = {
    select: {
        table: string;
        fields?: string[];
        where?: string;
        [key: string]: any;
    };
};
export declare type ValueExpression = SimpleKey;
export declare type FieldValueExpression = {
    [field: string]: SimpleKey;
};
export declare type FieldArrayValueExpression = {
    [field: string]: SimpleKey[];
};
export declare type NullCompareExpression = {
    $null: string;
} | {
    [oper in "$is" | "$isnot"]?: {
        [field: string]: null;
    };
};
export declare type ValueCompareExpression = FieldValueExpression | {
    [field: string]: {
        [oper in "$eq" | "$ne" | "$gt" | "$lt" | "$gte" | "$lte"]?: ValueExpression | SelectExpression;
    };
};
export declare type ArrayCompareExpression = FieldArrayValueExpression | {
    [field: string]: {
        [oper in "$between" | "$in" | "$nin"]?: ValueExpression[] | SelectExpression;
    };
};
export declare type LikeExpression = {
    [key: string]: {
        $like: string;
    };
};
export declare type CompareExpression = ValueCompareExpression | ArrayCompareExpression | LikeExpression | NullCompareExpression;
export declare type RelationExpression = CompareExpression[] | {
    $not: CompareExpression | RelationExpression;
} | {
    [oper in "$and" | "$or"]?: CompareExpression[] | RelationExpression[];
};
export declare type SqlCondition = CompareExpression | RelationExpression;
export declare type LimitAndOffset = {
    limit?: number;
    offset?: number;
};
export declare type SqlResultRange = number | LimitAndOffset;
export declare type SqlOrderItem = {
    [field: string]: "ASC" | "DESC" | 1 | -1;
};
export declare type SqlOrder = SqlOrderItem | SqlOrderItem[];
export interface SqlBuilder {
    buildDropSchema<T extends object>(schema: ModelSchema<T>): string;
    buildSchema<T extends object>(schema: ModelSchema<T>): string[];
    buildInsert<T extends object>(schema: ModelSchema<T>, fieldValues: JsonObject): SqlAndParameters;
    buildDelete<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): SqlAndParameters;
    buildUpdate<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>, fieldValues: JsonObject, version: number): SqlAndParameters;
    buildSelect<T extends object>(schema: ModelSchema<T>, params: JsonObject): SqlAndParameters;
    buildSelect<T extends object>(schema: ModelSchema<T>, fields: string[], where: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, join?: JsonObject): SqlAndParameters;
}
export declare class JsonSqlBuilder implements SqlBuilder {
    buildDropSchema<T extends object>(schema: ModelSchema<T>): string;
    buildSchema<T extends object>(schema: ModelSchema<T>): string[];
    buildInsert<T extends object>(schema: ModelSchema<T>, fieldValues: JsonObject): SqlAndParameters;
    buildDelete<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>): SqlAndParameters;
    buildUpdate<T extends object>(schema: ModelSchema<T>, key: PrimaryKey<T>, fieldValues: JsonObject, version: number): SqlAndParameters;
    buildSelect<T extends object>(schema: ModelSchema<T>, params: string[] | JsonObject, where?: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, join?: JsonObject): SqlAndParameters;
    private getTableName;
    private replaceJsonFields;
    private getPrimaryKeyCondition;
}

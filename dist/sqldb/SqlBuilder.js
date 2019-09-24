"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Common_1 = require("../Common");
const Model_1 = require("../Model");
const Utils_1 = require("../Utils");
const JsonSqlCtor = require("json-sql");
const JsonSql = JsonSqlCtor({ separatedValues: false });
exports.MULTI_SQL_SEPARATOR = ";";
var SqlType;
(function (SqlType) {
    SqlType[SqlType["Schema"] = 0] = "Schema";
    SqlType[SqlType["Select"] = 1] = "Select";
    SqlType[SqlType["Insert"] = 2] = "Insert";
    SqlType[SqlType["Update"] = 3] = "Update";
    SqlType[SqlType["Delete"] = 4] = "Delete";
    SqlType[SqlType["Other"] = 9] = "Other";
})(SqlType = exports.SqlType || (exports.SqlType = {}));
class JsonSqlBuilder {
    buildDropSchema(schema) {
        return `drop table "${this.getTableName(schema.modelName)}"`;
    }
    buildSchema(schema) {
        let result = [];
        const sqlStatement = Object.assign({ type: "create" }, Common_1.deepCopy(schema.schemaObject));
        schema.jsonProperties
            .forEach(value => {
            const findObj = sqlStatement.tableFields.find(val => val.name === value);
            if (findObj) {
                findObj.type = Model_1.FieldTypes.Text;
            }
        });
        sqlStatement.tableFields
            .filter(value => Utils_1.Utils.Lang.isString(value.unique))
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
    buildInsert(schema, fieldValues) {
        const result = { type: SqlType.Insert, query: "" };
        return Object.assign(result, JsonSql.build({
            type: "insert",
            table: this.getTableName(schema.modelName),
            values: this.replaceJsonFields(schema, fieldValues)
        }));
    }
    buildDelete(schema, key) {
        const result = { type: SqlType.Delete, query: "" };
        return Object.assign(result, JsonSql.build({
            type: "remove",
            table: this.getTableName(schema.modelName),
            values: this.getPrimaryKeyCondition(schema, key)
        }));
    }
    buildUpdate(schema, key, fieldValues, version) {
        const tableName = this.getTableName(schema.modelName);
        const primaryKeyCond = this.getPrimaryKeyCondition(schema, key);
        primaryKeyCond._version_ = version;
        const result = { type: SqlType.Update, query: "" };
        return Object.assign(result, JsonSql.build({
            type: "update",
            table: tableName,
            modifier: this.replaceJsonFields(schema, fieldValues),
            condition: primaryKeyCond
        }));
    }
    buildSelect(schema, params, where, resultRange, sort, join) {
        const tableName = this.getTableName(schema.modelName);
        let sqlStatement = {};
        if (Array.isArray(params)) {
            const fields = params || schema.properties.map(value => schema.schemaObject.table + "." + value);
            const limit = typeof resultRange === "number" ? { limit: resultRange } : (resultRange || {});
            let sorted = sort || {};
            let flag = true;
            if (!Array.isArray(sorted)) {
                sorted = [sorted];
                flag = false;
            }
            for (let item of sorted) {
                for (let key of Reflect.ownKeys(item)) {
                    if (typeof key === "string" || typeof key === "number") {
                        const value = item[key] || -1;
                        item[key] = "ASC" === value ? 1 : ("DESC" === value ? -1 : value);
                    }
                }
            }
            sqlStatement = {
                type: "select",
                table: tableName,
                fields: fields,
                condition: where,
                limit: limit.limit,
                offset: limit.offset,
                sort: flag ? sorted : sorted[0],
                join: join
            };
        }
        else {
            sqlStatement = Object.assign({ type: "select", table: tableName }, params);
        }
        const result = { type: SqlType.Select, query: "" };
        return Object.assign(result, JsonSql.build(sqlStatement));
    }
    ////
    getTableName(name) {
        return Utils_1.Utils.String.snakeCase(name) + "s";
    }
    replaceJsonFields(schema, fieldValues) {
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
    getPrimaryKeyCondition(schema, key) {
        return schema.setPrimaryKey({}, key);
    }
}
exports.JsonSqlBuilder = JsonSqlBuilder;

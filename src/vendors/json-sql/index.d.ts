declare namespace json_sql {
    interface JsonSql {
        build(args: any): { query: string };
    }

    interface JsonSqlConstructor {
        (options: { separatedValues: boolean }): JsonSql;
    }
}

declare const json_sql: json_sql.JsonSqlConstructor;

declare module "json-sql" {
    export = json_sql;
}
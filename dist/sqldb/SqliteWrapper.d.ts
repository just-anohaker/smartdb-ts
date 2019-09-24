import { Callback } from "../Common";
import { SqlParameters, SqlAndParameters } from "./SqlBuilder";
import { SqlExecuteResult } from "./DbConnection";
export declare class SqliteWrapper {
    private log;
    private db;
    constructor();
    readonly isConnected: boolean;
    open(dbFilePath: string, callback?: Callback<boolean>): boolean;
    asyncOpen(dbFilePath: string): Promise<boolean>;
    close(callback?: Callback<boolean>): boolean;
    asyncClose(): Promise<boolean>;
    execute(sql: string, parameters?: SqlParameters, callback?: Callback<SqlExecuteResult>): SqlExecuteResult;
    query(sql: string, parameters?: SqlParameters, callback?: Callback<any[]>): any[];
    executeBatch(sqls: SqlAndParameters[], onExecuted?: (ret: SqlExecuteResult, s: SqlAndParameters) => void, callback?: Callback<SqlExecuteResult[]>): SqlExecuteResult[];
    asyncExecute(sql: string, parameters?: SqlParameters): Promise<SqlExecuteResult>;
    asyncQuery(sql: string, parameters?: SqlParameters): Promise<any[]>;
    asyncExecuteBatch(sqls: SqlAndParameters[], onExecuted?: (ret: SqlExecuteResult, s: SqlAndParameters) => void): Promise<SqlExecuteResult[]>;
}

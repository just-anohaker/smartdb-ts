import { SqlParameters, SqlAndParameters } from "./SqlBuilder";
import { DbRecord } from "../Model";
export declare type ConnectionOptions = {
    [keys in "storage" | "userName" | "password" | "database"]?: any;
};
export interface SqlExecuteResult {
    lastInsertRowId: string;
    rowsEffected: number;
}
export interface DbConnection {
    connectionOptions: ConnectionOptions;
    isConnected: boolean;
    connect(): Promise<boolean>;
    disconnect(): Promise<boolean>;
    runScript(sql: string): Promise<void>;
    query(sql: string, parameters?: SqlParameters): Promise<DbRecord[]>;
    querySync(sql: string, parameters?: SqlParameters): DbRecord[];
    execute(sql: string, parameters?: SqlParameters, throwIfNoneEffected?: boolean): Promise<SqlExecuteResult>;
    executeSync(sql: string, parameters?: SqlParameters, throwIfNoneEffected?: boolean): SqlExecuteResult;
    executeBatch(sqls: SqlAndParameters[]): Promise<SqlExecuteResult[]>;
    executeBatchSync(sqls: SqlAndParameters[]): SqlExecuteResult[];
    beginTrans(): Promise<DBTransaction>;
}
export interface DBTransaction {
    commit(): Promise<void>;
    rollback(): Promise<void>;
}

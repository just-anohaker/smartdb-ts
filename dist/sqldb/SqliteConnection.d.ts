import { ConnectionOptions, DbConnection, SqlExecuteResult, DBTransaction } from "./DbConnection";
import { SqlParameters, SqlAndParameters } from "./SqlBuilder";
import { DbRecord } from "../Model";
export declare class SqliteConnection implements DbConnection {
    private options;
    private sqlite;
    constructor(options: ConnectionOptions);
    readonly connectionOptions: ConnectionOptions;
    readonly isConnected: boolean;
    connect(): Promise<boolean>;
    disconnect(): Promise<boolean>;
    query(sql: string, parameters?: SqlParameters): Promise<DbRecord[]>;
    querySync(sql: string, parameters?: SqlParameters): DbRecord[];
    executeBatch(sqls: SqlAndParameters[]): Promise<SqlExecuteResult[]>;
    executeBatchSync(sqls: SqlAndParameters[]): SqlExecuteResult[];
    execute(sql: string, parameters?: SqlParameters, throwIfNoneEffected?: boolean): Promise<SqlExecuteResult>;
    executeSync(sql: string, parameters?: SqlParameters, throwIfNoneEffected?: boolean): SqlExecuteResult;
    runScript(sql: string): Promise<void>;
    beginTrans(): Promise<DBTransaction>;
    ensureexecuteEffected(result: SqlExecuteResult): void;
}

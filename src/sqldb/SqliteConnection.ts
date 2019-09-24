import { ConnectionOptions, DbConnection, SqlExecuteResult, DBTransaction } from "./DbConnection";
import { SqlParameters, SqlAndParameters, MULTI_SQL_SEPARATOR } from "./SqlBuilder";
import { DbRecord } from "../Model";
import { SqliteWrapper } from "./SqliteWrapper";

class _DBTransaction implements DBTransaction {
    constructor(private connection: DbConnection) {

    }

    async commit(): Promise<void> {
        await this.connection.execute("COMMIT;");
    }

    async rollback(): Promise<void> {
        await this.connection.execute("ROLLBACK;");
    }
}

export class SqliteConnection implements DbConnection {
    private sqlite: SqliteWrapper;
    constructor(private options: ConnectionOptions) {
        this.sqlite = new SqliteWrapper();
    }

    get connectionOptions(): ConnectionOptions {
        return this.options;
    }

    get isConnected(): boolean {
        return this.sqlite.isConnected;
    }

    async connect(): Promise<boolean> {
        return await this.sqlite.asyncOpen(this.options.storage);
    }

    async disconnect(): Promise<boolean> {
        return await this.sqlite.asyncClose();
    }

    async query(sql: string, parameters?: SqlParameters): Promise<DbRecord[]> {
        return await this.sqlite.asyncQuery(sql, parameters);
    }

    querySync(sql: string, parameters?: SqlParameters): DbRecord[] {
        return this.sqlite.query(sql, parameters);
    }

    async executeBatch(sqls: SqlAndParameters[]): Promise<SqlExecuteResult[]> {
        return await this.sqlite.asyncExecuteBatch(sqls || [], this.ensureexecuteEffected);
    }

    executeBatchSync(sqls: SqlAndParameters[]): SqlExecuteResult[] {
        return this.sqlite.executeBatch(sqls || [], this.ensureexecuteEffected);
    }

    async execute(sql: string, parameters?: SqlParameters, throwIfNoneEffected?: boolean): Promise<SqlExecuteResult> {
        const result = await this.sqlite.asyncExecute(sql, parameters);
        if (throwIfNoneEffected) {
            this.ensureexecuteEffected(result);
        }
        return result;
    }

    executeSync(sql: string, parameters?: SqlParameters, throwIfNoneEffected?: boolean): SqlExecuteResult {
        const result = this.sqlite.execute(sql, parameters);
        if (throwIfNoneEffected) {
            this.ensureexecuteEffected(result);
        }
        return result;
    }

    async runScript(sql: string): Promise<void> {
        sql.split(MULTI_SQL_SEPARATOR)
            .forEach(value => {
                if (value.trim() !== "") {
                    this.sqlite.execute(value, []);
                }
            });
    }

    async beginTrans(): Promise<DBTransaction> {
        await this.execute("BEGIN TRANSACTION;");
        return new _DBTransaction(this);
    }

    //// 
    ensureexecuteEffected(result: SqlExecuteResult): void {
        if (result.rowsEffected === 0) throw new Error("None row effected");
    }
}
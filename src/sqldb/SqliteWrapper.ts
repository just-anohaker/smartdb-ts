import { Callback, MaybeUndefined } from "../Common";
import { Logger, LogManager } from "../Log";
import { SqlParameters, SqlAndParameters, JsonSqlBuilder, SqlType, } from "./SqlBuilder";
import { SqlExecuteResult } from "./DbConnection";
import Sqlite3 = require("better-sqlite3");

export class SqliteWrapper {
    private log: Logger;
    private db: MaybeUndefined<Sqlite3.Database>;

    constructor() {
        this.log = LogManager.getLogger("SqliteWrapper");
    }

    get isConnected(): boolean {
        if (this.db) {
            return this.db.open;
        }
        return false;
    }

    open(dbFilePath: string, callback?: Callback<boolean>): boolean {
        const result = { err: null, result: true }
        try {
            this.db = new Sqlite3(dbFilePath);
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS open(db=${dbFilePath})`);
            }
        } catch (err) {
            result.err = err;
            result.result = false;
            if (this.log.errorEnabled) {
                this.log.error(`FAILED open (db=${result})`, err);
            }
            if (!callback) throw err;
        }

        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }

    async asyncOpen(dbFilePath: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.open(dbFilePath, (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    close(callback?: Callback<boolean>): boolean {
        let result = { err: undefined, result: true };
        try {
            if (this.db && this.isConnected) {
                this.db.close();
                if (this.log.traceEnabled) {
                    this.log.trace("SUCCESS close");
                }
            } else {
                if (this.log.infoEnabled) {
                    this.log.info("closed already");
                }
            }
        } catch (err) {
            result.err = err;
            result.result = false;
            if (this.log.errorEnabled) {
                this.log.error("FAILD close", err);
            }
            if (!callback) throw err;
        }

        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }

    async asyncClose(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.close((err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    execute(sql: string, parameters?: SqlParameters, callback?: Callback<SqlExecuteResult>): SqlExecuteResult {
        const result = {
            err: undefined,
            result: {
                lastInsertRowId: "0",
                rowsEffected: 0
            }
        };
        try {
            if (!this.db) {
                throw new Error("database not opened.");
            }
            const runResult: Sqlite3.RunResult = this.db.prepare(sql).run(parameters || []);
            result.result = {
                lastInsertRowId: runResult.lastInsertRowid.toString(),
                rowsEffected: runResult.changes
            };
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS execute sql=${sql} param=${JSON.stringify(parameters)}, effected=${result.result.rowsEffected}`);
            }
        } catch (err) {
            result.err = err;
            if (this.log.errorEnabled) {
                this.log.error(`FAILD execute sql=${sql} param=${JSON.stringify(parameters)}`, err);
            }
            if (!callback) throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }

    query(sql: string, parameters?: SqlParameters, callback?: Callback<any[]>): any[] {
        const result: {
            err: MaybeUndefined<Error>;
            result: any[]
        } = {
            err: undefined,
            result: []
        };
        try {
            if (!this.db) {
                throw new Error("database not opened.");
            }
            result.result = this.db.prepare(sql).all(parameters || []);
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS query sql=${sql} param=${JSON.stringify(parameters)}, result count=${result.result.length}`);
            }
        } catch (err) {
            result.err = err;
            if (this.log.errorEnabled) {
                this.log.error(`FAILD query sql=${sql} param=${JSON.stringify(parameters)}`, err);
            }
            if (!callback) throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }

    executeBatch(sqls: SqlAndParameters[], onExecuted?: (ret: SqlExecuteResult, s: SqlAndParameters) => void, callback?: Callback<SqlExecuteResult[]>): SqlExecuteResult[] {
        const result: {
            err: MaybeUndefined<Error>;
            result: SqlExecuteResult[]
        } = {
            err: undefined,
            result: []
        };
        let sqlRunItem: SqlAndParameters;
        try {
            sqls.forEach(value => {
                sqlRunItem = value;
                let execResult = this.execute(value.query, value.parameters);
                if (onExecuted) {
                    onExecuted(execResult, sqlRunItem);
                }
                result.result.push(execResult);
            })
        } catch (err) {
            result.err = err;
            if (this.log.errorEnabled) {
                this.log.error(`FAILD executeBatch, sql=${sqlRunItem!.query} param=${JSON.stringify(sqlRunItem!.parameters)}`, err);
            }
            if (!callback) throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }

    async asyncExecute(sql: string, parameters?: SqlParameters): Promise<SqlExecuteResult> {
        return new Promise((resolve, reject) => {
            this.execute(sql, parameters, (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async asyncQuery(sql: string, parameters?: SqlParameters): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.query(sql, parameters, (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    async asyncExecuteBatch(sqls: SqlAndParameters[], onExecuted?: (ret: SqlExecuteResult, s: SqlAndParameters) => void): Promise<SqlExecuteResult[]> {
        return new Promise((resolve, reject) => {
            this.executeBatch(sqls, onExecuted, (err, result) => {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }
}

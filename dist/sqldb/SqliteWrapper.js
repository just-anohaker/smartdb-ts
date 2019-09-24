"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Log_1 = require("../Log");
const Sqlite3 = require("better-sqlite3");
class SqliteWrapper {
    constructor() {
        this.log = Log_1.LogManager.getLogger("SqliteWrapper");
    }
    get isConnected() {
        if (this.db) {
            return this.db.open;
        }
        return false;
    }
    open(dbFilePath, callback) {
        const result = { err: null, result: true };
        try {
            this.db = new Sqlite3(dbFilePath);
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS open(db=${dbFilePath})`);
            }
        }
        catch (err) {
            result.err = err;
            result.result = false;
            if (this.log.errorEnabled) {
                this.log.error(`FAILED open (db=${result})`, err);
            }
            if (!callback)
                throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }
    asyncOpen(dbFilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.open(dbFilePath, (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        });
    }
    close(callback) {
        let result = { err: undefined, result: true };
        try {
            if (this.db && this.isConnected) {
                this.db.close();
                if (this.log.traceEnabled) {
                    this.log.trace("SUCCESS close");
                }
            }
            else {
                if (this.log.infoEnabled) {
                    this.log.info("closed already");
                }
            }
        }
        catch (err) {
            result.err = err;
            result.result = false;
            if (this.log.errorEnabled) {
                this.log.error("FAILD close", err);
            }
            if (!callback)
                throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }
    asyncClose() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.close((err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        });
    }
    execute(sql, parameters, callback) {
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
            const runResult = this.db.prepare(sql).run(parameters || []);
            result.result = {
                lastInsertRowId: runResult.lastInsertRowid.toString(),
                rowsEffected: runResult.changes
            };
            if (this.log.traceEnabled) {
                this.log.trace(`SUCCESS execute sql=${sql} param=${JSON.stringify(parameters)}, effected=${result.result.rowsEffected}`);
            }
        }
        catch (err) {
            result.err = err;
            if (this.log.errorEnabled) {
                this.log.error(`FAILD execute sql=${sql} param=${JSON.stringify(parameters)}`, err);
            }
            if (!callback)
                throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }
    query(sql, parameters, callback) {
        const result = {
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
        }
        catch (err) {
            result.err = err;
            if (this.log.errorEnabled) {
                this.log.error(`FAILD query sql=${sql} param=${JSON.stringify(parameters)}`, err);
            }
            if (!callback)
                throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }
    executeBatch(sqls, onExecuted, callback) {
        const result = {
            err: undefined,
            result: []
        };
        let sqlRunItem;
        try {
            sqls.forEach(value => {
                sqlRunItem = value;
                let execResult = this.execute(value.query, value.parameters);
                if (onExecuted) {
                    onExecuted(execResult, sqlRunItem);
                }
                result.result.push(execResult);
            });
        }
        catch (err) {
            result.err = err;
            if (this.log.errorEnabled) {
                this.log.error(`FAILD executeBatch, sql=${sqlRunItem.query} param=${JSON.stringify(sqlRunItem.parameters)}`, err);
            }
            if (!callback)
                throw err;
        }
        if (callback) {
            callback(result.err, result.result);
        }
        return result.result;
    }
    asyncExecute(sql, parameters) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.execute(sql, parameters, (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        });
    }
    asyncQuery(sql, parameters) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.query(sql, parameters, (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        });
    }
    asyncExecuteBatch(sqls, onExecuted) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.executeBatch(sqls, onExecuted, (err, result) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(result);
                });
            });
        });
    }
}
exports.SqliteWrapper = SqliteWrapper;

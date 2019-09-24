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
const SqlBuilder_1 = require("./SqlBuilder");
const SqliteWrapper_1 = require("./SqliteWrapper");
class _DBTransaction {
    constructor(connection) {
        this.connection = connection;
    }
    commit() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.connection.execute("COMMIT;");
        });
    }
    rollback() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.connection.execute("ROLLBACK;");
        });
    }
}
class SqliteConnection {
    constructor(options) {
        this.options = options;
        this.sqlite = new SqliteWrapper_1.SqliteWrapper();
    }
    get connectionOptions() {
        return this.options;
    }
    get isConnected() {
        return this.sqlite.isConnected;
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sqlite.asyncOpen(this.options.storage);
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sqlite.asyncClose();
        });
    }
    query(sql, parameters) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sqlite.asyncQuery(sql, parameters);
        });
    }
    querySync(sql, parameters) {
        return this.sqlite.query(sql, parameters);
    }
    executeBatch(sqls) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sqlite.asyncExecuteBatch(sqls || [], this.ensureexecuteEffected);
        });
    }
    executeBatchSync(sqls) {
        return this.sqlite.executeBatch(sqls || [], this.ensureexecuteEffected);
    }
    execute(sql, parameters, throwIfNoneEffected) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.sqlite.asyncExecute(sql, parameters);
            if (throwIfNoneEffected) {
                this.ensureexecuteEffected(result);
            }
            return result;
        });
    }
    executeSync(sql, parameters, throwIfNoneEffected) {
        const result = this.sqlite.execute(sql, parameters);
        if (throwIfNoneEffected) {
            this.ensureexecuteEffected(result);
        }
        return result;
    }
    runScript(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            sql.split(SqlBuilder_1.MULTI_SQL_SEPARATOR)
                .forEach(value => {
                if (value.trim() !== "") {
                    this.sqlite.execute(value, []);
                }
            });
        });
    }
    beginTrans() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.execute("BEGIN TRANSACTION;");
            return new _DBTransaction(this);
        });
    }
    //// 
    ensureexecuteEffected(result) {
        if (result.rowsEffected === 0)
            throw new Error("None row effected");
    }
}
exports.SqliteConnection = SqliteConnection;

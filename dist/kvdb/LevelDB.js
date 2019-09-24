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
const Level = require("level");
const LevelSecondary = require("level-secondary");
const LevelSubLevel = require("level-sublevel");
const Utils_1 = require("../Utils");
function getCallback(callback) {
    if (callback) {
        return {
            callback,
            promise: undefined
        };
    }
    callback = (function () {
        let result;
        const t = new Promise((resolve, reject) => {
            result = ((e, s) => e ? reject(e) : resolve(s));
        });
        result.promise = t;
        return result;
    })();
    const promise = callback.promise;
    return {
        callback,
        promise
    };
}
class SubLevelMeta {
    constructor(subName, keyField, indexFields = []) {
        this.subName = subName;
        this.keyField = keyField;
        this.indexFields = indexFields;
    }
    existsIndex(fieldName) {
        return this.findIndexOfFieldName(fieldName) > -1;
    }
    addIndex(fieldName, calcIndex) {
        if (this.existsIndex(fieldName)) {
            throw new Error(`Index of field '${fieldName}' already exists`);
        }
        this.indexFields.push({
            fieldName,
            calcIndex
        });
        return this;
    }
    removeIndex(fieldName) {
        const findIdx = this.findIndexOfFieldName(fieldName);
        if (findIdx > -1) {
            this.indexFields.slice(findIdx, 1);
        }
        return this;
    }
    ////
    findIndexOfFieldName(fieldName) {
        return this.indexFields.findIndex(value => value.fieldName === fieldName);
    }
}
exports.SubLevelMeta = SubLevelMeta;
class _IndexedLevel {
    constructor(subLevelDb, subName, keyField, ..._indexArray) {
        this.subLevelDb = subLevelDb;
        this.subName = subName;
        this.keyField = keyField;
        this.indexArray = [].concat(..._indexArray);
        this.indexedSubLevels = new Map();
        this.indexArray.forEach(value => {
            const secondary = LevelSecondary(subLevelDb, value.fieldName, value.calcIndex);
            this.indexedSubLevels.set(value.fieldName, secondary);
        });
    }
    get name() {
        return this.subName;
    }
    get indexes() {
        return this.indexArray;
    }
    get(key, options, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const { callback, promise } = getCallback(cb);
            try {
                this.subLevelDb.get(key, options, this.keyNotFoundThenUndefined(callback));
            }
            catch (err) {
                callback(LevelDB.isKeyNotFoundError(err), undefined);
            }
            return promise;
        });
    }
    byIndex(index) {
        const levelGet = this.indexedSubLevels.get(index);
        if (levelGet === undefined) {
            throw new Error(`No such index field = '${index}'`);
        }
        return levelGet;
    }
    getBy(index, key, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const levelGet = this.byIndex(index);
            const { callback, promise } = getCallback(cb);
            try {
                levelGet.get(key, this.keyNotFoundThenUndefined(callback));
            }
            catch (error) {
                callback(LevelDB.isKeyNotFoundError(error) ? undefined : error, undefined);
            }
            return promise;
        });
    }
    put(key, value, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const { callback, promise } = getCallback(cb);
            try {
                this.subLevelDb.put(key, value, callback);
            }
            catch (error) {
                callback(error, undefined);
            }
            return promise;
        });
    }
    del(key, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const { callback, promise } = getCallback(cb);
            try {
                this.subLevelDb.del(key, callback);
            }
            catch (error) {
                callback(error, undefined);
            }
            return promise;
        });
    }
    batch(arr, options, cb) {
        return __awaiter(this, arguments, void 0, function* () {
            if (arguments.length === 0)
                return this.subLevelDb.batch();
            const notFunction = options && !Utils_1.Utils.Lang.isFunction(options);
            const newCb = notFunction ? cb : options;
            const { callback, promise } = getCallback(newCb);
            try {
                if (notFunction) {
                    this.subLevelDb.batch(arr, options, callback);
                }
                else {
                    this.subLevelDb.batch(arr, callback);
                }
            }
            catch (error) {
                callback(error, undefined);
            }
            return promise;
        });
    }
    createReadStream(options) {
        return this.subLevelDb.createReadStream(options);
    }
    createKeyStream(options) {
        return this.subLevelDb.createKeyStream(options);
    }
    createValueStream(options) {
        return this.subLevelDb.createValueStream(options);
    }
    ////
    get key() {
        return this.keyField;
    }
    keyNotFoundThenUndefined(callback) {
        if (callback) {
            return (err, value) => {
                callback(LevelDB.isKeyNotFoundError(err) ? null : err, value);
            };
        }
        return undefined;
    }
}
class LevelDB {
    constructor(dbDir, subMetas = [], options = {}) {
        this.dbDir = dbDir;
        this.subMetas = subMetas;
        this.leveldb = undefined;
        this.subLevels = new Map();
    }
    static isKeyNotFoundError(err) {
        return err && "NotFoundError" === err.name;
    }
    get level() {
        return this.leveldb;
    }
    get isOpen() {
        return this.leveldb && this.leveldb.isOpen();
    }
    get isClosed() {
        return !this.leveldb || this.leveldb.isClosed();
    }
    getSubLevel(subName) {
        const sublevel = this.subLevels.get(subName);
        if (sublevel === undefined) {
            throw new Error(`No such subLevel name='${subName}'`);
        }
        return sublevel;
    }
    open(openCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            const { callback, promise } = getCallback(openCallback);
            if (this.isOpen) {
                process.nextTick(callback, null, this);
            }
            else {
                (() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.init();
                        process.nextTick(callback, null, this);
                    }
                    catch (error) {
                        process.nextTick(callback, error, this);
                    }
                }))();
            }
            return promise;
        });
    }
    close(closeCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            const { callback, promise } = getCallback(closeCallback);
            if (this.isClosed) {
                process.nextTick(callback, null, this);
            }
            else {
                (() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.leveldb.close();
                        this.leveldb = null;
                        process.nextTick(callback, null, this);
                    }
                    catch (error) {
                        process.nextTick(callback, error, this);
                    }
                }))();
            }
            return promise;
        });
    }
    dump() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const stringBuffer = [];
                this.leveldb.createReadStream()
                    .on("data", (value) => stringBuffer.push(`key=${value.key}, value=${value.value}`))
                    .on("error", (error) => reject(error))
                    .on("end", () => resolve(stringBuffer.join("\r\n")));
            });
        });
    }
    ////
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.leveldb = Level(this.dbDir, {
                valueEncoding: "json"
            });
            this.subLevelDb = LevelSubLevel(this.leveldb);
            this.subMetas.forEach(value => this.registerSubLevel(value));
        });
    }
    registerSubLevel(subMeta) {
        const sublevel = this.subLevelDb.sublevel(subMeta.subName);
        const secondary = new _IndexedLevel(sublevel, subMeta.subName, subMeta.keyField, ...subMeta.indexFields);
        this.subLevels.set(subMeta.subName, secondary);
    }
}
exports.LevelDB = LevelDB;

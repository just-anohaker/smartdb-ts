import Level = require("level");
import LevelSecondary = require("level-secondary");
import LevelSubLevel = require("level-sublevel");

import { JsonObject, Callback, MaybeUndefined } from "../Common";
import { Utils } from "../Utils";

function getCallback(callback?: Function): { callback?: Function; promise?: Promise<any> } {
    if (callback) {
        return {
            callback,
            promise: undefined
        };
    }

    const promise = new Promise((resolve, reject) => {
        callback = (err: any, value: any) => {
            if (err) {
                return reject(err);
            }
            return resolve(value);
        };
    });

    return {
        callback,
        promise
    };
}

export type GetIndexValueFunc = (key: any, value: JsonObject) => any;

export type IndexField = {
    fieldName: string;
    calcIndex?: GetIndexValueFunc;
}

export class SubLevelMeta {
    constructor(public subName: string, public keyField: string, public indexFields: IndexField[] = []) { }

    private findIndexOfFieldName(fieldName: string): number {
        return this.indexFields.findIndex(value => value.fieldName === fieldName);
    }

    existsIndex(fieldName: string): boolean {
        return this.findIndexOfFieldName(fieldName) > -1;
    }

    addIndex(fieldName: string, calcIndex: GetIndexValueFunc): this {
        if (this.existsIndex(fieldName)) {
            throw new Error(`Index of field '${fieldName}' already exists`);
        }
        this.indexFields.push({
            fieldName,
            calcIndex
        });
        return this;
    }

    removeIndex(fieldName: any): this {
        const findIdx = this.findIndexOfFieldName(fieldName);
        if (findIdx > -1) {
            this.indexFields.slice(findIdx, 1);
        }
        return this;
    }
}

export interface LevelReadableStream extends NodeJS.ReadableStream {
    on(eventName: string, callback: Function): this;
}

export interface LevelGet {
    get<T>(key: any, options?: JsonObject, getCallback?: Callback<MaybeUndefined<T>>): Promise<MaybeUndefined<T>>;
    createReadStream(options?: JsonObject): LevelReadableStream;
    createKeyStream(options?: JsonObject): LevelReadableStream;
    createValueStream(options?: JsonObject): LevelReadableStream;
}

export interface LevelOperation {
    put<T>(key: any, value: T, options?: JsonObject, callback?: Callback<void>): Promise<void>;
    del(key: any, delCallback?: Callback<void>): Promise<void>;
    batch(operArray: JsonObject[], options?: JsonObject): Promise<void>;
}

export interface IndexedLevel extends LevelGet, LevelOperation {
    name: string;
    indexes: IndexField[];
    byIndex(indexField: string): LevelGet;
    getBy<T>(indexField: string, key: any, getCallback?: Callback<MaybeUndefined<T>>): Promise<MaybeUndefined<T>>;
}

class IndexedLevelImpl implements IndexedLevel {
    private indexArray: IndexField[];
    private indexedSubLevels: Map<string, LevelSecondary.Secondary>;
    constructor(
        private subLevelDb: LevelSubLevel.Sublevel,
        private subName: string,
        private keyField: string,
        ..._indexArray: IndexField[]
    ) {
        this.indexArray = [];
        this.indexArray = this.indexArray.concat(..._indexArray);
        this.indexedSubLevels = new Map<string, LevelSecondary.Secondary>();
        this.indexArray.forEach(value => {
            const secondary = LevelSecondary(subLevelDb, value.fieldName, value.calcIndex);
            this.indexedSubLevels.set(value.fieldName, secondary);
        });
    }

    get key(): string {
        return this.keyField
    }

    get name(): string {
        return this.subName;
    }

    get indexes(): IndexField[] {
        return this.indexArray;
    }

    keyNotFoundThenUndefined(callback?: Function): { (err: any, value: any): any } | undefined {
        if (callback) {
            return (err: any, value: any) => {
                callback(LevelDB.isKeyNotFoundError(err) ? null : err, value);
            }
        }

        return undefined;
    }

    async get<T>(key: any, options?: any, cb?: Callback<MaybeUndefined<T>>): Promise<MaybeUndefined<T>> {
        const { callback, promise } = getCallback(cb);
        try {
            this.subLevelDb.get(key, options, this.keyNotFoundThenUndefined(callback))
        } catch (err) {
            callback!(err, undefined);
        }

        return promise;
    }

    byIndex(index: string): LevelGet {
        const levelGet = this.indexedSubLevels.get(index);
        if (levelGet === undefined) {
            throw new Error(`No such index field = '${index}'`);
        }
        return levelGet;
    }

    async getBy<T>(index: any, key: any, cb?: Callback<MaybeUndefined<T>>): Promise<MaybeUndefined<T>> {
        const levelGet = this.byIndex(index);
        const { callback, promise } = getCallback(cb);
        try {
            levelGet.get(key, this.keyNotFoundThenUndefined(callback));
        } catch (error) {
            callback!(LevelDB.isKeyNotFoundError(error) ? undefined : error, undefined);
        }
        return promise;
    }

    async put<T>(key: any, value: T, cb?: Callback<void>): Promise<void> {
        const { callback, promise } = getCallback(cb);
        try {
            this.subLevelDb.put(key, value, callback! as (err: any) => any);
        } catch (error) {
            callback!(error, undefined);
        }
        return promise;
    }

    async del(key: any, cb?: Callback<void>): Promise<any> {
        const { callback, promise } = getCallback(cb);
        try {
            this.subLevelDb.del(key, callback! as (err: any) => any);
        } catch (error) {
            callback!(error, undefined);
        }

        return promise;
    }

    async batch(arr: any[], options?: any, cb?: Function): Promise<any> {
        // if (arguments.length === 0) return this.subLevelDb.batch();

        const notFunction = options && !Utils.Lang.isFunction(options);
        const newCb = notFunction ? cb : options;
        const { callback, promise } = getCallback(newCb);
        try {
            if (notFunction) {
                this.subLevelDb.batch(arr, options, callback! as (error?: any) => any);
            } else {
                this.subLevelDb.batch(arr, callback! as (error?: any) => any);
            }
        } catch (error) {
            callback!(error, undefined);
        }
        return promise;
    }

    createReadStream(options: any): any {
        return this.subLevelDb.createReadStream(options);
    }

    createKeyStream(options: any): any {
        return this.subLevelDb.createKeyStream(options);
    }

    createValueStream(options: any): any {
        return this.subLevelDb.createValueStream(options);
    }
}

export class LevelDB {
    static isKeyNotFoundError(err: Error): boolean {
        return err && "NotFoundError" === err.name;
    }

    private subLevels: Map<string, IndexedLevel>;
    private subLevelDb?: LevelSubLevel.Sublevel;
    private leveldb?: any;
    constructor(private dbDir: string, private subMetas: SubLevelMeta[], options?: {}) {
        this.leveldb = undefined;
        this.subLevels = new Map<string, IndexedLevel>();
    }

    get isOpen(): boolean {
        return this.leveldb && this.leveldb.isOpen();
    }

    get isClosed(): boolean {
        return !this.leveldb || this.leveldb.isClosed();
    }

    async init(): Promise<void> {
        this.leveldb = Level(this.dbDir, {
            valueEncoding: "json"
        });
        this.subLevelDb = LevelSubLevel(this.leveldb);
        this.subMetas.forEach(value => this.registerSubLevel(value));
    }

    registerSubLevel(subMeta: SubLevelMeta): void {
        const sublevel = this.subLevelDb!.sublevel(subMeta.subName);
        const secondary = new IndexedLevelImpl(sublevel, subMeta.subName, subMeta.keyField, ...subMeta.indexFields);
        this.subLevels.set(subMeta.subName, secondary);
    }

    getSubLevel(subName: string): IndexedLevel {
        const sublevel = this.subLevels.get(subName);
        if (sublevel === undefined) {
            throw new Error(`No such subLevel name='${subName}'`);
        }
        return sublevel;
    }

    open(openCallback?: Callback<any>): Promise<any> | undefined {
        const { callback, promise } = getCallback(openCallback);
        if (this.isOpen) {
            process.nextTick(callback!, null, this);
        } else {
            (async () => {
                try {
                    await this.init();
                    process.nextTick(callback!, null, this);
                } catch (error) {
                    process.nextTick(callback!, error, this);
                }
            })();
        }

        return promise;
    }

    close(closeCallback?: Callback<any>): Promise<any> | undefined {
        const { callback, promise } = getCallback(closeCallback);
        if (this.isClosed) {
            process.nextTick(callback!, null, this);
        } else {
            (async () => {
                try {
                    await this.leveldb.close();
                    this.leveldb = null;
                    process.nextTick(callback!, null, this);
                } catch (error) {
                    process.nextTick(callback!, error, this);
                }
            })();
        }

        return promise;
    }

    dump(): Promise<string> {
        return new Promise((resolve, reject) => {
            const stringBuffer: string[] = [];
            this.leveldb.createReadStream()
                .on("data", (value: any) => stringBuffer.push(`key=${value.key}, value=${value.value}`))
                .on("error", (error: any) => reject(error))
                .on("end", () => resolve(stringBuffer.join("\r\n")));
        });
    }
}


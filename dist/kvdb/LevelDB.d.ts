/// <reference types="node" />
import { JsonObject, Callback, MaybeUndefined } from "../Common";
export declare type GetIndexValueFunc = (key: any, value: JsonObject) => any;
export declare type IndexField = {
    fieldName: string;
    calcIndex?: GetIndexValueFunc;
};
export declare class SubLevelMeta {
    subName: string;
    keyField: string;
    indexFields: IndexField[];
    constructor(subName: string, keyField: string, indexFields?: IndexField[]);
    existsIndex(fieldName: string): boolean;
    addIndex(fieldName: string, calcIndex: GetIndexValueFunc): this;
    removeIndex(fieldName: any): this;
    private findIndexOfFieldName;
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
export declare class LevelDB {
    private dbDir;
    private subMetas;
    static isKeyNotFoundError(err: Error): boolean;
    private subLevels;
    private subLevelDb?;
    private leveldb?;
    constructor(dbDir: string, subMetas?: SubLevelMeta[], options?: {});
    readonly level: any;
    readonly isOpen: boolean;
    readonly isClosed: boolean;
    getSubLevel(subName: string): IndexedLevel;
    open(openCallback?: Callback<any>): Promise<any | null>;
    close(closeCallback?: Callback<any>): Promise<any | null>;
    dump(): Promise<string>;
    private init;
    private registerSubLevel;
}

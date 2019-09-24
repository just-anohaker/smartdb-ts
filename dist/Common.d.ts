export declare type MaybeUndefined<T> = T | undefined;
export declare type Nullable<T> = T | null | undefined;
export interface ObjectLiteral {
    [key: string]: any;
}
export declare type JsonObject = ObjectLiteral;
export declare type Entity = ObjectLiteral;
export declare type Property<T> = keyof T & string;
export declare type Partial<T> = {
    [P in keyof T]?: T[P];
};
export declare type ReadonlyPartial<T> = {
    readonly [P in keyof T]?: T[P];
};
export declare type Minix<T1, T2> = T1 & T2;
export declare type FilterFunction<T> = (e: T) => boolean;
export declare type Callback<T> = (err: Nullable<Error>, data: T) => void;
export declare function makeJsonObject<T>(iterable: Iterable<T>, getKey: (t: T) => string, getValue: (t: T) => any): JsonObject;
export declare function deepCopy<T>(src: T): T;
export declare function partialCopy<T extends object>(src: T, keysOrKeyFilter: string[] | ((key: string) => boolean), dest?: Partial<T>): Partial<T>;
export declare function isPrimitiveKey(key: any): boolean;
export declare class NotImplementError extends Error {
    constructor(message?: string);
}
export declare class CodeContractError extends Error {
    constructor(message: string);
}
export declare type ContractCondition = boolean | (() => boolean);
export declare type ContractMessage = string | (() => string);
export declare type ContractVerifyResult = {
    result: boolean;
    message: Nullable<string>;
};
export declare type VerifyFunction = () => ContractVerifyResult;
export declare class CodeContract {
    static verify(condition: ContractCondition, message: ContractMessage): void;
    static argument(argName: string, verify: VerifyFunction | ContractCondition, message?: ContractMessage): void;
    static notNull(arg: any): ContractVerifyResult;
    static notNullOrEmpty(str: Nullable<string>): ContractVerifyResult;
    static notNullOrWhitespace(str: Nullable<string>): ContractVerifyResult;
}

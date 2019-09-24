export type MaybeUndefined<T> = T | undefined;
export type Nullable<T> = T | null | undefined;

export interface ObjectLiteral {
    [key: string]: any
}
export type JsonObject = ObjectLiteral;
export type Entity = ObjectLiteral;

export type Property<T> = keyof T & string;
export type Partial<T> = {
    [P in keyof T]?: T[P];
}
export type ReadonlyPartial<T> = {
    readonly [P in keyof T]?: T[P];
}
export type Minix<T1, T2> = T1 & T2;

export type FilterFunction<T> = (e: T) => boolean;
export type Callback<T> = (err: Nullable<Error>, data: T) => void;

export function makeJsonObject<T>(iterable: Iterable<T>, getKey: (t: T) => string, getValue: (t: T) => any): JsonObject {
    CodeContract.argument("iterable", () => CodeContract.notNull(iterable));
    CodeContract.argument("getKey", () => CodeContract.notNull(getKey));
    CodeContract.argument("getValue", () => CodeContract.notNull(getValue));
    let result: JsonObject = {};
    for (let iter of Array.from(iterable)) {
        result[getKey(iter)] = getValue(iter);
    }
    return result;
}

export function deepCopy<T>(src: T): T {
    return src ? JSON.parse(JSON.stringify(src)) : src;
}

export function partialCopy<T extends object>(src: T, keysOrKeyFilter: string[] | ((key: string) => boolean), dest?: Partial<T>): Partial<T> {
    CodeContract.argument("src", () => CodeContract.notNull(src));
    CodeContract.argument("keysOrKeyFilter", () => CodeContract.notNull(keysOrKeyFilter));

    const keys: string[] = typeof keysOrKeyFilter === "function"
        ? Object.keys(src).filter(keysOrKeyFilter)
        : keysOrKeyFilter;
    const result: Partial<T> = dest || {};
    for (let key of keys) {
        if (Reflect.has(src, key)) {
            result[key as keyof T] = src[key as keyof T];
        }
    }
    return result;
}

export function isPrimitiveKey(key: any): boolean {
    return !!key && (typeof key === "string" || typeof key === "number");
}

export class NotImplementError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

export class CodeContractError extends Error {
    constructor(message: string) {
        super(`Code contract Error,${message}`);
    }
}

export type ContractCondition = boolean | (() => boolean);
export type ContractMessage = string | (() => string);
export type ContractVerifyResult = {
    result: boolean;
    message: Nullable<string>;
}

export type VerifyFunction = () => ContractVerifyResult;

export class CodeContract {
    static verify(condition: ContractCondition, message: ContractMessage): void {
        if (condition === undefined || condition === null) {
            throw new Error("Invalid verify condition");
        }
        const c = typeof condition === "function" ? condition() : condition;
        const m = typeof message === "function" ? message() : message;
        if (!c) throw new CodeContractError(m);
    }

    static argument(argName: string, verify: VerifyFunction | ContractCondition, message?: ContractMessage): void {
        // check
        if (!argName || !verify) {
            throw new Error("argName or verify can not be null or undefined");
        }
        if (message) {
            // verify as ContractCondition
            CodeContract.verify(verify as ContractCondition, message);
        } else {
            // verify as VerifyFunction
            const i = (verify as VerifyFunction)();
            CodeContract.verify(i.result, `argument '${argName}' ${i.message}`);
        }
    }

    static notNull(arg: any): ContractVerifyResult {
        const result = arg !== null && arg !== undefined;
        return {
            result,
            message: result ? undefined : "cannot be null or undefined"
        };
    }

    static notNullOrEmpty(str: Nullable<string>): ContractVerifyResult {
        const result = CodeContract.notNull(str) && str !== "";
        return {
            result,
            message: result ? undefined : "cannot be null or undefined or empty"
        };
    }

    static notNullOrWhitespace(str: Nullable<string>): ContractVerifyResult {
        const result = CodeContract.notNullOrEmpty(str) && str!.trim() !== "";
        return {
            result,
            message: result ? undefined : "cannot be null or undefined or whitespace"
        };
    }
}
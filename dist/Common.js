"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function makeJsonObject(iterable, getKey, getValue) {
    CodeContract.argument("iterable", () => CodeContract.notNull(iterable));
    CodeContract.argument("getKey", () => CodeContract.notNull(getKey));
    CodeContract.argument("getValue", () => CodeContract.notNull(getValue));
    let result = {};
    for (let iter of Array.from(iterable)) {
        result[getKey(iter)] = getValue(iter);
    }
    return result;
}
exports.makeJsonObject = makeJsonObject;
function deepCopy(src) {
    return src ? JSON.parse(JSON.stringify(src)) : src;
}
exports.deepCopy = deepCopy;
function partialCopy(src, keysOrKeyFilter, dest) {
    CodeContract.argument("src", () => CodeContract.notNull(src));
    CodeContract.argument("keysOrKeyFilter", () => CodeContract.notNull(keysOrKeyFilter));
    const keys = typeof keysOrKeyFilter === "function"
        ? Object.keys(src).filter(keysOrKeyFilter)
        : keysOrKeyFilter;
    const result = dest || {};
    for (let key of keys) {
        if (Reflect.has(src, key)) {
            result[key] = src[key];
        }
    }
    return result;
}
exports.partialCopy = partialCopy;
function isPrimitiveKey(key) {
    return !!key && (typeof key === "string" || typeof key === "number");
}
exports.isPrimitiveKey = isPrimitiveKey;
class NotImplementError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.NotImplementError = NotImplementError;
class CodeContractError extends Error {
    constructor(message) {
        super(`Code contract Error,${message}`);
    }
}
exports.CodeContractError = CodeContractError;
class CodeContract {
    static verify(condition, message) {
        if (condition === undefined || condition === null) {
            throw new Error("Invalid verify condition");
        }
        const c = typeof condition === "function" ? condition() : condition;
        const m = typeof message === "function" ? message() : message;
        if (!c)
            throw new CodeContractError(m);
    }
    static argument(argName, verify, message) {
        // check
        if (!argName || !verify) {
            throw new Error("argName or verify can not be null or undefined");
        }
        if (message) {
            // verify as ContractCondition
            CodeContract.verify(verify, message);
        }
        else {
            // verify as VerifyFunction
            const i = verify();
            CodeContract.verify(i.result, `argument '${argName}' ${i.message}`);
        }
    }
    static notNull(arg) {
        const result = arg !== null && arg !== undefined;
        return {
            result,
            message: result ? undefined : "cannot be null or undefined"
        };
    }
    static notNullOrEmpty(str) {
        const result = CodeContract.notNull(str) && str !== "";
        return {
            result,
            message: result ? undefined : "cannot be null or undefined or empty"
        };
    }
    static notNullOrWhitespace(str) {
        const result = CodeContract.notNullOrEmpty(str) && str.trim() !== "";
        return {
            result,
            message: result ? undefined : "cannot be null or undefined or whitespace"
        };
    }
}
exports.CodeContract = CodeContract;

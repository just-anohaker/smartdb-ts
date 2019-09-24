"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
function noop() { }
class PerformanceHelper {
    constructor() {
        this.traceName = "";
        this.uptime = 0;
        this.isEnabled = false;
        this.doTime = (name) => {
            this.traceName = name;
            this.uptime = process.uptime();
        };
        this.doEndTime = (continued = false) => {
            const uptime = process.uptime();
            console.log(`${this.traceName} cost ${uptime - this.uptime}s`);
            if (continued)
                this.uptime = uptime;
        };
        this.doRestartTime = (name) => {
            this.doEndTime(true);
            this.traceName = name;
        };
    }
    get time() {
        return this.isEnabled ? this.doTime : noop;
    }
    get endTime() {
        return this.isEnabled ? this.doEndTime : noop;
    }
    get restartTime() {
        return this.isEnabled ? this.doRestartTime : noop;
    }
    get enabled() {
        return this.isEnabled;
    }
    set enabled(val) {
        this.isEnabled = val;
    }
}
exports.PerformanceHelper = PerformanceHelper;
class UtilsImpl {
}
UtilsImpl._performance = new PerformanceHelper();
UtilsImpl._array = {
    chunk: lodash_1.default.chunk,
    compact: lodash_1.default.compact,
    concat: lodash_1.default.concat,
    difference: lodash_1.default.difference,
    differenceBy: lodash_1.default.differenceBy,
    differenceWith: lodash_1.default.differenceWith,
    drop: lodash_1.default.drop,
    dropRight: lodash_1.default.dropRight,
    dropRightWhile: lodash_1.default.dropRightWhile,
    dropWhile: lodash_1.default.dropWhile,
    fill: lodash_1.default.fill,
    findIndex: lodash_1.default.findIndex,
    findLastIndex: lodash_1.default.findLastIndex,
    first: lodash_1.default.first,
    head: lodash_1.default.head,
    flatten: lodash_1.default.flatten,
    flattenDeep: lodash_1.default.flattenDeep,
    flattenDepth: lodash_1.default.flattenDepth,
    fromPairs: lodash_1.default.fromPairs,
    indexOf: lodash_1.default.indexOf,
    initial: lodash_1.default.initial,
    intersection: lodash_1.default.intersection,
    intersectionBy: lodash_1.default.intersectionBy,
    intersectionWith: lodash_1.default.intersectionWith,
    join: lodash_1.default.join,
    last: lodash_1.default.last,
    lastIndexOf: lodash_1.default.lastIndexOf,
    nth: lodash_1.default.nth,
    pull: lodash_1.default.pull,
    pullAll: lodash_1.default.pullAll,
    pullAllBy: lodash_1.default.pullAllBy,
    pullAllWith: lodash_1.default.pullAllWith,
    pullAt: lodash_1.default.pullAt,
    remove: lodash_1.default.remove,
    reverse: lodash_1.default.reverse,
    slice: lodash_1.default.slice,
    sortedIndex: lodash_1.default.sortedIndex,
    sortedIndexBy: lodash_1.default.sortedIndexBy,
    sortedIndexOf: lodash_1.default.sortedIndexOf,
    sortedLastIndex: lodash_1.default.sortedLastIndex,
    sortedLastIndexBy: lodash_1.default.sortedLastIndexBy,
    sortedLastIndexOf: lodash_1.default.sortedLastIndexOf,
    sortedUniq: lodash_1.default.sortedUniq,
    sortedUniqBy: lodash_1.default.sortedUniqBy,
    tail: lodash_1.default.tail,
    take: lodash_1.default.take,
    takeRight: lodash_1.default.takeRight,
    takeRightWhile: lodash_1.default.takeRightWhile,
    takeWhile: lodash_1.default.takeWhile,
    union: lodash_1.default.union,
    unionBy: lodash_1.default.unionBy,
    unionWith: lodash_1.default.unionWith,
    uniq: lodash_1.default.uniq,
    uniqBy: lodash_1.default.uniqBy,
    uniqWith: lodash_1.default.uniqWith,
    unzip: lodash_1.default.unzip,
    unzipWith: lodash_1.default.unzipWith,
    without: lodash_1.default.without,
    xor: lodash_1.default.xor,
    xorBy: lodash_1.default.xorBy,
    xorWith: lodash_1.default.xorWith,
    zip: lodash_1.default.zip,
    zipObject: lodash_1.default.zipObject,
    zipObjectDeep: lodash_1.default.zipObjectDeep,
    zipWith: lodash_1.default.zipWith
};
UtilsImpl._string = {
    camelCase: lodash_1.default.camelCase,
    capitalize: lodash_1.default.capitalize,
    deburr: lodash_1.default.deburr,
    endsWith: lodash_1.default.endsWith,
    escape: lodash_1.default.escape,
    escapeRegExp: lodash_1.default.escapeRegExp,
    kebabCase: lodash_1.default.kebabCase,
    lowerCase: lodash_1.default.lowerCase,
    lowerFirst: lodash_1.default.lowerFirst,
    pad: lodash_1.default.pad,
    padEnd: lodash_1.default.padEnd,
    padStart: lodash_1.default.padStart,
    parseInt: lodash_1.default.parseInt,
    repeat: lodash_1.default.repeat,
    replace: lodash_1.default.replace,
    snakeCase: lodash_1.default.snakeCase,
    split: lodash_1.default.split,
    startCase: lodash_1.default.startCase,
    startsWith: lodash_1.default.startsWith,
    template: lodash_1.default.template,
    toLower: lodash_1.default.toLower,
    toUpper: lodash_1.default.toUpper,
    trim: lodash_1.default.trim,
    trimEnd: lodash_1.default.trimEnd,
    trimStart: lodash_1.default.trimStart,
    truncate: lodash_1.default.truncate,
    unescape: lodash_1.default.unescape,
    upperCase: lodash_1.default.upperCase,
    upperFirst: lodash_1.default.upperFirst,
    words: lodash_1.default.words
};
UtilsImpl._collection = {
    countBy: lodash_1.default.countBy,
    each: lodash_1.default.each,
    eachRight: lodash_1.default.eachRight,
    every: lodash_1.default.every,
    filter: lodash_1.default.filter,
    find: lodash_1.default.find,
    findLast: lodash_1.default.findLast,
    flatMap: lodash_1.default.flatMap,
    flatMapDeep: lodash_1.default.flatMapDeep,
    flatMapDepth: lodash_1.default.flatMapDepth,
    forEach: lodash_1.default.forEach,
    forEachRight: lodash_1.default.forEachRight,
    groupBy: lodash_1.default.groupBy,
    includes: lodash_1.default.includes,
    invokeMap: lodash_1.default.invokeMap,
    keyBy: lodash_1.default.keyBy,
    map: lodash_1.default.map,
    orderBy: lodash_1.default.orderBy,
    partition: lodash_1.default.partition,
    reduce: lodash_1.default.reduce,
    reduceRight: lodash_1.default.reduceRight,
    reject: lodash_1.default.reject,
    sample: lodash_1.default.sample,
    sampleSize: lodash_1.default.sampleSize,
    shuffle: lodash_1.default.shuffle,
    size: lodash_1.default.size,
    some: lodash_1.default.some,
    sortBy: lodash_1.default.sortBy
};
UtilsImpl._function = {
    after: lodash_1.default.after,
    ary: lodash_1.default.ary,
    before: lodash_1.default.before,
    bind: lodash_1.default.bind,
    bindKey: lodash_1.default.bindKey,
    curry: lodash_1.default.curry,
    curryRight: lodash_1.default.curryRight,
    debounce: lodash_1.default.debounce,
    defer: lodash_1.default.defer,
    delay: lodash_1.default.delay,
    flip: lodash_1.default.flip,
    memoize: lodash_1.default.memoize,
    negate: lodash_1.default.negate,
    once: lodash_1.default.once,
    overArgs: lodash_1.default.overArgs,
    partial: lodash_1.default.partial,
    partialRight: lodash_1.default.partialRight,
    rearg: lodash_1.default.rearg,
    rest: lodash_1.default.rest,
    spread: lodash_1.default.spread,
    throttle: lodash_1.default.throttle,
    unary: lodash_1.default.unary,
    wrap: lodash_1.default.wrap
};
UtilsImpl._object = {
    assign: lodash_1.default.assign,
    assignIn: lodash_1.default.assignIn,
    assignInWith: lodash_1.default.assignInWith,
    assignWith: lodash_1.default.assignWith,
    at: lodash_1.default.at,
    create: lodash_1.default.create,
    defaults: lodash_1.default.defaults,
    defaultsDeep: lodash_1.default.defaultsDeep,
    entries: lodash_1.default.entries,
    entriesIn: lodash_1.default.entriesIn,
    extend: lodash_1.default.extend,
    findKey: lodash_1.default.findKey,
    findLastKey: lodash_1.default.findLastKey,
    forIn: lodash_1.default.forIn,
    forInRight: lodash_1.default.forInRight,
    forOwn: lodash_1.default.forOwn,
    forOwnRight: lodash_1.default.forOwnRight,
    functions: lodash_1.default.functions,
    functionsIn: lodash_1.default.functionsIn,
    get: lodash_1.default.get,
    has: lodash_1.default.has,
    hasIn: lodash_1.default.hasIn,
    invert: lodash_1.default.invert,
    invertBy: lodash_1.default.invertBy,
    invoke: lodash_1.default.invoke,
    keys: lodash_1.default.keys,
    keysIn: lodash_1.default.keysIn,
    mapKeys: lodash_1.default.mapKeys,
    mapValues: lodash_1.default.mapValues,
    merge: lodash_1.default.merge,
    mergeWith: lodash_1.default.mergeWith,
    omit: lodash_1.default.omit,
    omitBy: lodash_1.default.omitBy,
    pick: lodash_1.default.pick,
    pickBy: lodash_1.default.pickBy,
    result: lodash_1.default.result,
    set: lodash_1.default.set,
    setWith: lodash_1.default.setWith,
    toPairs: lodash_1.default.toPairs,
    toPairsIn: lodash_1.default.toPairsIn,
    transform: lodash_1.default.transform,
    unset: lodash_1.default.unset,
    update: lodash_1.default.update,
    updateWith: lodash_1.default.updateWith,
    values: lodash_1.default.values,
    valuesIn: lodash_1.default.valuesIn
};
UtilsImpl._lang = {
    castArray: lodash_1.default.castArray,
    clone: lodash_1.default.clone,
    cloneDeep: lodash_1.default.cloneDeep,
    cloneDeepWith: lodash_1.default.cloneDeepWith,
    cloneWith: lodash_1.default.cloneWith,
    conformsTo: lodash_1.default.conformsTo,
    eq: lodash_1.default.eq,
    gt: lodash_1.default.gt,
    gte: lodash_1.default.gte,
    isArguments: lodash_1.default.isArguments,
    isArray: lodash_1.default.isArray,
    isArrayBuffer: lodash_1.default.isArrayBuffer,
    isArrayLike: lodash_1.default.isArrayLike,
    isArrayLikeObject: lodash_1.default.isArrayLikeObject,
    isBoolean: lodash_1.default.isBoolean,
    isBuffer: lodash_1.default.isBuffer,
    isDate: lodash_1.default.isDate,
    isElement: lodash_1.default.isElement,
    isEmpty: lodash_1.default.isEmpty,
    isEqual: lodash_1.default.isEqual,
    isEqualWith: lodash_1.default.isEqualWith,
    isError: lodash_1.default.isError,
    isFinite: lodash_1.default.isFinite,
    isFunction: lodash_1.default.isFunction,
    isInteger: lodash_1.default.isInteger,
    isLength: lodash_1.default.isLength,
    isMap: lodash_1.default.isMap,
    isMatch: lodash_1.default.isMatch,
    isMatchWith: lodash_1.default.isMatchWith,
    isNaN: lodash_1.default.isNaN,
    isNative: lodash_1.default.isNative,
    isNil: lodash_1.default.isNil,
    isNull: lodash_1.default.isNull,
    isNumber: lodash_1.default.isNumber,
    isObject: lodash_1.default.isObject,
    isObjectLike: lodash_1.default.isObjectLike,
    isPlainObject: lodash_1.default.isPlainObject,
    isRegExp: lodash_1.default.isRegExp,
    isSafeInteger: lodash_1.default.isSafeInteger,
    isSet: lodash_1.default.isSet,
    isString: lodash_1.default.isString,
    isSymbol: lodash_1.default.isSymbol,
    isTypedArray: lodash_1.default.isTypedArray,
    isUndefined: lodash_1.default.isUndefined,
    isWeakmap: lodash_1.default.isWeakMap,
    isWeakSet: lodash_1.default.isWeakSet,
    lt: lodash_1.default.lt,
    lte: lodash_1.default.lte,
    toArray: lodash_1.default.toArray,
    toFinite: lodash_1.default.toFinite,
    toLength: lodash_1.default.toLength,
    toNumber: lodash_1.default.toNumber,
    toPlainObject: lodash_1.default.toPlainObject,
    toSafeInteger: lodash_1.default.toSafeInteger,
    toString: lodash_1.default.toString
};
class Utils {
    static get Performance() {
        return UtilsImpl._performance;
    }
    static get Array() {
        return UtilsImpl._array;
    }
    static get String() {
        return UtilsImpl._string;
    }
    static get Collection() {
        return UtilsImpl._collection;
    }
    static get Function() {
        return UtilsImpl._function;
    }
    static get Object() {
        return UtilsImpl._object;
    }
    static get Lang() {
        return UtilsImpl._lang;
    }
}
exports.Utils = Utils;
exports.default = Utils;

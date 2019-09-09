import _ from "lodash";

function noop() { }

export class PerformanceHelper {
    private traceName: string = "";
    private uptime: number = 0;
    private isEnabled: boolean = false;

    private doTime: (name: string) => void;
    private doEndTime: (ended: boolean) => void;
    private doRestartTime: (name: string) => void;

    constructor() {
        this.doTime = (name: string): void => {
            this.traceName = name;
            this.uptime = process.uptime();
        };

        this.doEndTime = (continued: boolean = false): void => {
            const uptime = process.uptime();
            console.log(`${this.traceName} cost ${uptime - this.uptime}s`);
            if (continued) this.uptime = uptime;
        };

        this.doRestartTime = (name: string): void => {
            this.doEndTime(true);
            this.traceName = name;
        }
    }

    get time(): (name: string) => void {
        return this.isEnabled ? this.doTime : noop;
    }

    get endTime(): (continued: boolean) => void {
        return this.isEnabled ? this.doEndTime : noop;
    }

    get restartTime(): (name: string) => void {
        return this.isEnabled ? this.doRestartTime : noop;
    }

    get enabled(): boolean {
        return this.isEnabled;
    }

    set enabled(val: boolean) {
        this.isEnabled = val;
    }
}

class UtilsImpl {
    static _performance: PerformanceHelper = new PerformanceHelper();

    static _array: { [name: string]: any } = {
        chunk: _.chunk,
        compact: _.compact,
        concat: _.concat,
        difference: _.difference,
        differenceBy: _.differenceBy,
        differenceWith: _.differenceWith,
        drop: _.drop,
        dropRight: _.dropRight,
        dropRightWhile: _.dropRightWhile,
        dropWhile: _.dropWhile,
        fill: _.fill,
        findIndex: _.findIndex,
        findLastIndex: _.findLastIndex,
        first: _.first,
        head: _.head,
        flatten: _.flatten,
        flattenDeep: _.flattenDeep,
        flattenDepth: _.flattenDepth,
        fromPairs: _.fromPairs,
        indexOf: _.indexOf,
        initial: _.initial,
        intersection: _.intersection,
        intersectionBy: _.intersectionBy,
        intersectionWith: _.intersectionWith,
        join: _.join,
        last: _.last,
        lastIndexOf: _.lastIndexOf,
        nth: _.nth,
        pull: _.pull,
        pullAll: _.pullAll,
        pullAllBy: _.pullAllBy,
        pullAllWith: _.pullAllWith,
        pullAt: _.pullAt,
        remove: _.remove,
        reverse: _.reverse,
        slice: _.slice,
        sortedIndex: _.sortedIndex,
        sortedIndexBy: _.sortedIndexBy,
        sortedIndexOf: _.sortedIndexOf,
        sortedLastIndex: _.sortedLastIndex,
        sortedLastIndexBy: _.sortedLastIndexBy,
        sortedLastIndexOf: _.sortedLastIndexOf,
        sortedUniq: _.sortedUniq,
        sortedUniqBy: _.sortedUniqBy,
        tail: _.tail,
        take: _.take,
        takeRight: _.takeRight,
        takeRightWhile: _.takeRightWhile,
        takeWhile: _.takeWhile,
        union: _.union,
        unionBy: _.unionBy,
        unionWith: _.unionWith,
        uniq: _.uniq,
        uniqBy: _.uniqBy,
        uniqWith: _.uniqWith,
        unzip: _.unzip,
        unzipWith: _.unzipWith,
        without: _.without,
        xor: _.xor,
        xorBy: _.xorBy,
        xorWith: _.xorWith,
        zip: _.zip,
        zipObject: _.zipObject,
        zipObjectDeep: _.zipObjectDeep,
        zipWith: _.zipWith
    };

    static _string: { [name: string]: any } = {
        camelCase: _.camelCase,
        capitalize: _.capitalize,
        deburr: _.deburr,
        endsWith: _.endsWith,
        escape: _.escape,
        escapeRegExp: _.escapeRegExp,
        kebabCase: _.kebabCase,
        lowerCase: _.lowerCase,
        lowerFirst: _.lowerFirst,
        pad: _.pad,
        padEnd: _.padEnd,
        padStart: _.padStart,
        parseInt: _.parseInt,
        repeat: _.repeat,
        replace: _.replace,
        snakeCase: _.snakeCase,
        split: _.split,
        startCase: _.startCase,
        startsWith: _.startsWith,
        template: _.template,
        toLower: _.toLower,
        toUpper: _.toUpper,
        trim: _.trim,
        trimEnd: _.trimEnd,
        trimStart: _.trimStart,
        truncate: _.truncate,
        unescape: _.unescape,
        upperCase: _.upperCase,
        upperFirst: _.upperFirst,
        words: _.words
    };

    static _collection: { [name: string]: any } = {
        countBy: _.countBy,
        each: _.each,
        eachRight: _.eachRight,
        every: _.every,
        filter: _.filter,
        find: _.find,
        findLast: _.findLast,
        flatMap: _.flatMap,
        flatMapDeep: _.flatMapDeep,
        flatMapDepth: _.flatMapDepth,
        forEach: _.forEach,
        forEachRight: _.forEachRight,
        groupBy: _.groupBy,
        includes: _.includes,
        invokeMap: _.invokeMap,
        keyBy: _.keyBy,
        map: _.map,
        orderBy: _.orderBy,
        partition: _.partition,
        reduce: _.reduce,
        reduceRight: _.reduceRight,
        reject: _.reject,
        sample: _.sample,
        sampleSize: _.sampleSize,
        shuffle: _.shuffle,
        size: _.size,
        some: _.some,
        sortBy: _.sortBy
    };

    static _function: { [name: string]: any } = {
        after: _.after,
        ary: _.ary,
        before: _.before,
        bind: _.bind,
        bindKey: _.bindKey,
        curry: _.curry,
        curryRight: _.curryRight,
        debounce: _.debounce,
        defer: _.defer,
        delay: _.delay,
        flip: _.flip,
        memoize: _.memoize,
        negate: _.negate,
        once: _.once,
        overArgs: _.overArgs,
        partial: _.partial,
        partialRight: _.partialRight,
        rearg: _.rearg,
        rest: _.rest,
        spread: _.spread,
        throttle: _.throttle,
        unary: _.unary,
        wrap: _.wrap
    };

    static _object: { [name: string]: any } = {
        assign: _.assign,
        assignIn: _.assignIn,
        assignInWith: _.assignInWith,
        assignWith: _.assignWith,
        at: _.at,
        create: _.create,
        defaults: _.defaults,
        defaultsDeep: _.defaultsDeep,
        entries: _.entries,
        entriesIn: _.entriesIn,
        extend: _.extend,
        findKey: _.findKey,
        findLastKey: _.findLastKey,
        forIn: _.forIn,
        forInRight: _.forInRight,
        forOwn: _.forOwn,
        forOwnRight: _.forOwnRight,
        functions: _.functions,
        functionsIn: _.functionsIn,
        get: _.get,
        has: _.has,
        hasIn: _.hasIn,
        invert: _.invert,
        invertBy: _.invertBy,
        invoke: _.invoke,
        keys: _.keys,
        keysIn: _.keysIn,
        mapKeys: _.mapKeys,
        mapValues: _.mapValues,
        merge: _.merge,
        mergeWith: _.mergeWith,
        omit: _.omit,
        omitBy: _.omitBy,
        pick: _.pick,
        pickBy: _.pickBy,
        result: _.result,
        set: _.set,
        setWith: _.setWith,
        toPairs: _.toPairs,
        toPairsIn: _.toPairsIn,
        transform: _.transform,
        unset: _.unset,
        update: _.update,
        updateWith: _.updateWith,
        values: _.values,
        valuesIn: _.valuesIn
    };

    static _lang: { [name: string]: any } = {
        castArray: _.castArray,
        clone: _.clone,
        cloneDeep: _.cloneDeep,
        cloneDeepWith: _.cloneDeepWith,
        cloneWith: _.cloneWith,
        conformsTo: _.conformsTo,
        eq: _.eq,
        gt: _.gt,
        gte: _.gte,
        isArguments: _.isArguments,
        isArray: _.isArray,
        isArrayBuffer: _.isArrayBuffer,
        isArrayLike: _.isArrayLike,
        isArrayLikeObject: _.isArrayLikeObject,
        isBoolean: _.isBoolean,
        isBuffer: _.isBuffer,
        isDate: _.isDate,
        isElement: _.isElement,
        isEmpty: _.isEmpty,
        isEqual: _.isEqual,
        isEqualWith: _.isEqualWith,
        isError: _.isError,
        isFinite: _.isFinite,
        isFunction: _.isFunction,
        isInteger: _.isInteger,
        isLength: _.isLength,
        isMap: _.isMap,
        isMatch: _.isMatch,
        isMatchWith: _.isMatchWith,
        isNaN: _.isNaN,
        isNative: _.isNative,
        isNil: _.isNil,
        isNull: _.isNull,
        isNumber: _.isNumber,
        isObject: _.isObject,
        isObjectLike: _.isObjectLike,
        isPlainObject: _.isPlainObject,
        isRegExp: _.isRegExp,
        isSafeInteger: _.isSafeInteger,
        isSet: _.isSet,
        isString: _.isString,
        isSymbol: _.isSymbol,
        isTypedArray: _.isTypedArray,
        isUndefined: _.isUndefined,
        isWeakmap: _.isWeakMap,
        isWeakSet: _.isWeakSet,
        lt: _.lt,
        lte: _.lte,
        toArray: _.toArray,
        toFinite: _.toFinite,
        toLength: _.toLength,
        toNumber: _.toNumber,
        toPlainObject: _.toPlainObject,
        toSafeInteger: _.toSafeInteger,
        toString: _.toString
    };
}

export class Utils {
    static get Performance(): PerformanceHelper {
        return UtilsImpl._performance;
    }

    static get Array(): { [name: string]: any } {
        return UtilsImpl._array;
    }

    static get String(): { [name: string]: any } {
        return UtilsImpl._string;
    }

    static get Collection(): { [name: string]: any } {
        return UtilsImpl._collection;
    }

    static get Function(): { [name: string]: any } {
        return UtilsImpl._function;
    }

    static get Object(): { [name: string]: any } {
        return UtilsImpl._object;
    }

    static get Lang(): { [name: string]: any } {
        return UtilsImpl._lang;
    }
}

export default Utils;
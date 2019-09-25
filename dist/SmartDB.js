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
const events_1 = require("events");
const Common_1 = require("./Common");
const Log_1 = require("./Log");
const LevelBlock_1 = require("./LevelBlock");
const BlockCache_1 = require("./BlockCache");
const SqliteConnection_1 = require("./sqldb/SqliteConnection");
const DbSession_1 = require("./DbSession");
const Utils_1 = require("./Utils");
const TRANSACTION_MODEL_NAME = "Transaction";
/**
 * ORM like to operate blockchain data
 * @event ready emit after initialized
 * @event close emit after closed
 */
class SmartDB extends events_1.EventEmitter {
    /**
     * Constructor
     * NOTIC: you need call init before use SmartDB
     * @param dbPath: path of blockchain db
     * @param levelBlockDir path of block header db
     * @param options of SmartDB
     */
    constructor(dbPath, levelBlockDir, options) {
        super();
        this.commitBlockHooks = [];
        this.rollbackBlockHooks = [];
        this.schemas = new Map();
        Common_1.CodeContract.argument("dbPath", () => Common_1.CodeContract.notNullOrWhitespace(dbPath));
        Common_1.CodeContract.argument("levelBlockDir", () => Common_1.CodeContract.notNullOrWhitespace(levelBlockDir));
        this.options = options || { cachedBlockCount: 10, maxBlockHistoryHold: 10 };
        this.log = Log_1.LogManager.getLogger("SmartDB");
        this.blockDB = new LevelBlock_1.LevelBlock(levelBlockDir);
        this.cachedBlocks = new BlockCache_1.BlockCache(this.options.cachedBlockCount);
        this.connection = new SqliteConnection_1.SqliteConnection({ storage: dbPath });
        this.blockSession = new DbSession_1.DbSession(this.connection, this.loadHistoryFromLevelDB.bind(this), { name: "Block" });
        this.localSession = new DbSession_1.DbSession(this.connection, null, { name: "Local" });
    }
    /**
     * height of last block
     */
    get lastBlockHeight() {
        return this.blockDB.lastBlockHeight;
    }
    /**
     * blocks count
     */
    get blocksCount() {
        return this.lastBlockHeight + 1;
    }
    /**
     * last commited block
     */
    get lastBlock() {
        return this.cachedBlocks.get(this.lastBlockHeight);
    }
    /**
     * register commit block hook, which will be called before commit block
     * @param name hook name
     * @param hookFunc hook function, (block) => void
     */
    registerCommitBlockHook(name, hookFunc) {
        Common_1.CodeContract.argument("hookFunc", () => Common_1.CodeContract.notNull(hookFunc));
        Common_1.CodeContract.argument("name", () => Common_1.CodeContract.notNullOrWhitespace(name));
        Common_1.CodeContract.argument("name", this.commitBlockHooks.every(value => value.name !== name.trim()), `hook named '${name}' exist already`);
        this.commitBlockHooks.push({
            name,
            hook: hookFunc
        });
    }
    /**
     * unregister commit block hook
     * @param name hook name
     */
    unregisterCommitBlockHook(name) {
        Common_1.CodeContract.argument("name", () => Common_1.CodeContract.notNullOrWhitespace(name));
        const findIdx = this.commitBlockHooks.findIndex(value => value.name === name.trim());
        if (findIdx >= 0) {
            this.commitBlockHooks.slice(findIdx);
        }
    }
    /**
     * register rollback block hook, whick will be called before commit block
     * @param name hook name
     * @param hookFunc hook function, (fromHeight, toHeight) => void
     */
    registerRollbackBlockHook(name, hookFunc) {
        Common_1.CodeContract.argument("hookFunc", () => Common_1.CodeContract.notNull(hookFunc));
        Common_1.CodeContract.argument("name", () => Common_1.CodeContract.notNullOrWhitespace(name));
        Common_1.CodeContract.argument("name", this.rollbackBlockHooks.some(val => val.name === name.trim()), `hook named '${name}' exist already`);
        this.rollbackBlockHooks.push({
            name,
            hook: hookFunc
        });
    }
    /**
     * unregister rollback block hook
     * @param name hook name
     */
    unregisterRollbackBlockHook(name) {
        Common_1.CodeContract.argument("name", () => Common_1.CodeContract.notNullOrWhitespace(name));
        const findIdx = this.rollbackBlockHooks.findIndex(val => val.name === name.trim());
        if (findIdx >= 0) {
            this.rollbackBlockHooks.slice(findIdx);
        }
    }
    /**
     * initialize SmartDB, you need call this before use SmartDB
     * @param schemas table schema in Database
     */
    init(schemas) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("schemas", () => Common_1.CodeContract.notNull(schemas));
            yield this.connection.connect();
            yield this.blockDB.open();
            yield this.syncSchemas(schemas);
            yield this.ensureLastBlockLoaded();
            yield this.blockSession.initSerial(this.blockDB.lastBlockHeight);
            yield this.localSession.initSerial(-1);
            this.emit("ready", this);
        });
    }
    /**
     * update schema, NOTIC: table must be empty!!!
     * @param schema schema
     */
    updateSchema(schema) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("schema", () => Common_1.CodeContract.notNull(schema));
            const newSchema = this.getSchema(schema.modelName);
            const session = this.getSession(newSchema);
            yield session.updateSchema(schema);
            if (this.log.infoEnabled) {
                this.log.info(`model ${schema.modelName} schema updated`);
            }
        });
    }
    /**
     * free resources
     */
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.blockSession.close();
            yield this.localSession.close();
            yield this.blockDB.close();
            this.emit("closed", this);
        });
    }
    /**
     * hold a lock name which only succeed in first time of each block
     * @param lockName lock name
     * @param notThrow do not throw exception if lock failed
     * @throws lock failed if lockName exists already and notThrow is false
     */
    lockInCurrentBlock(lockName, notThrow = false) {
        return this.blockSession.lockInThisSession(lockName, notThrow);
    }
    /**
     * hold a lock name which only succeed in first time of each block
     * @param lockName lock name
     * @throws lock failed if lockName exists already
     */
    lock(lockName) {
        this.lockInCurrentBlock(lockName, false);
    }
    /**
     * hold a lock name which only succeed if first time of each block
     * @param lockName lock name
     * @throws true if lock succeed else false
     */
    tryLock(lockName) {
        return this.lockInCurrentBlock(lockName, true);
    }
    /**
     * begin a contract transaction which effect entities in memory
     */
    beginContract() {
        this.blockSession.beginEntityTransaction();
    }
    /**
     * commit entities changes, these changes will be save into database when block forged
     */
    commitContract() {
        this.blockSession.commitEntityTransaction();
    }
    /**
     * rollback entities changes in memory
     */
    rollbackContract() {
        this.blockSession.rollbackEntityTransaction();
    }
    /**
     * begin a new block
     * @param block
     */
    beginBlock(block) {
        Common_1.CodeContract.argument("block", () => Common_1.CodeContract.notNull(block));
        Common_1.CodeContract.argument("block", block.height === this.lastBlockHeight + 1, `invalid block height ${block.height}, last=${this.lastBlockHeight}`);
        if (this.log.infoEnabled) {
            this.log.info(`BEGIN block height=${block.height}`);
        }
        this.currentBlock = block;
    }
    /**
     * commit block changes
     */
    commitBlock() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.currentBlock) {
                throw new Error("Current block is null");
            }
            if (this.log.traceEnabled) {
                this.log.trace(`BEGIN commitBlock height=${this.currentBlock.height}`);
            }
            this.preCommitBlock(this.currentBlock);
            const copyBlock = Object.assign({}, this.currentBlock);
            Reflect.deleteProperty(copyBlock, "transactions");
            Utils_1.Utils.Performance.time("Append block");
            yield this.blockDB.appendBlock(copyBlock, this.blockSession.getChanges());
            Utils_1.Utils.Performance.endTime(false);
            try {
                yield this.blockSession.saveChanges(this.currentBlock.height);
                this.cachedBlocks.push(this.currentBlock);
                this.currentBlock = undefined;
                this.postCommitBlock(this.lastBlock);
                if (this.log.infoEnabled) {
                    this.log.info(`SUCCESS commitBlock height=${this.lastBlockHeight}`);
                }
                return this.lastBlockHeight;
            }
            catch (error) {
                if (this.log.errorEnabled) {
                    this.log.error(`FAILED commitBlock (height=${this.currentBlock.height})`, error);
                }
                yield this.blockDB.deleteLastBlock(this.currentBlock.height);
                throw error;
            }
        });
    }
    /**
     * rollback block changes
     * @param height rollback to height(excluded)
     */
    rollbackBlock(height) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("height", !height || height <= this.lastBlockHeight, `height must less or equal lastBlockHeight ${this.lastBlockHeight}`);
            const currentHeight = this.currentBlock ? this.currentBlock.height : this.lastBlockHeight;
            const argHeight = height === undefined ? this.lastBlockHeight : height;
            if (this.log.traceEnabled) {
                this.log.trace(`BEGIN rollbackBlock (height: ${currentHeight} -> ${argHeight})`);
            }
            this.preRollbackBlock(currentHeight, argHeight);
            try {
                yield this.blockSession.rollbackChanges(argHeight);
                while (this.lastBlockHeight > argHeight) {
                    yield this.blockDB.deleteLastBlock(this.lastBlockHeight);
                    this.cachedBlocks.evitUntil(this.lastBlockHeight);
                }
                yield this.ensureLastBlockLoaded();
                this.currentBlock = undefined;
                this.postRollbackBlock(currentHeight, argHeight);
                if (this.log.infoEnabled) {
                    this.log.info(`SUCCESS rollbackBlock (height: ${currentHeight} -> ${argHeight})`);
                }
            }
            catch (error) {
                if (this.log.errorEnabled) {
                    this.log.error(`FAILED rollbackBlock (height: ${currentHeight} -> ${argHeight})`, error);
                }
                throw error;
            }
        });
    }
    /**
     * save changes of local tables (not in block --- which define in schema by local: true) into database
     * @returns serial number for changes
     */
    saveLocalChanges() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.localSession.saveChanges();
        });
    }
    /**
     * rollback local tables changes saveLocalChanges
     * @param serial serial number return from saveLocalChanges
     */
    rollbackLocalChanges(serial) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("serial", serial >= 0, "serial must great or equal zero");
            yield this.localSession.rollbackChanges(serial);
        });
    }
    /**
     * create a new entity which change will be tracked and persistented (by saveChanges) automatically
     * @param model modelName or model type
     * @param entity prototype entity which properties will copy to result entity
     * @returns tracking entity
     */
    create(model, entity) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("entity", () => Common_1.CodeContract.notNull(entity));
        const schema = this.getSchema(model, true, true);
        return this.getSession(schema).create(schema, entity);
    }
    createOrLoad(model, entity) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("entity", () => Common_1.CodeContract.notNull(entity));
        const schema = this.getSchema(model, true, true);
        const val = this.loadSync(model, schema.getNormalizedPrimaryKey(entity));
        return {
            create: val === undefined,
            entity: val || this.create(model, entity)
        };
    }
    increase(model, increasements, key) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("increasements", () => Common_1.CodeContract.notNull(increasements));
        Common_1.CodeContract.argument("key", () => Common_1.CodeContract.notNull(key));
        const schema = this.getSchema(model, true, true);
        return this.getSession(schema).increase(schema, key, increasements);
    }
    /**
     * update a entity
     * @param model modelName or model type
     * @param modifier primary key of entity or partial entity with primary key property(s)
     * @param key json modifier, keyOrEntity properties used as modifier if not given
     */
    update(model, modifier, key) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("modifier", () => Common_1.CodeContract.notNull(modifier));
        Common_1.CodeContract.argument("key", () => Common_1.CodeContract.notNull(key));
        const schema = this.getSchema(model, true, true);
        if (this.options.checkModifier === true) {
            const keys = Object.keys(modifier);
            const without = Utils_1.Utils.Array.without(schema.properties, ...keys);
            if (without.length > 0) {
                throw new Error(`modifier or entity contains property which is not defined in model(${JSON.stringify(without)})`);
            }
        }
        this.getSession(schema).update(schema, key, modifier);
    }
    /**
     * delete a entity
     * @param model modelName or model type
     * @param key primaryKey of entity
     */
    del(model, key) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("key", () => Common_1.CodeContract.notNull(key));
        const schema = this.getSchema(model, true, true);
        this.getSession(schema).delete(schema, key);
    }
    /**
     * load entity from cache and database
     * @param model model name or model type
     * @param key key of entity
     */
    load(model, key) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
            Common_1.CodeContract.argument("key", () => Common_1.CodeContract.notNull(key));
            const schema = this.getSchema(model, true);
            return (yield this.getSession(schema).load(schema, key));
        });
    }
    loadSync(model, key) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("key", () => Common_1.CodeContract.notNull(key));
        const schema = this.getSchema(model, true);
        return (this.getSession(schema).loadSync(schema, key));
    }
    /**
     * get entities from database
     * @param model model name or model type
     * @param condition find condition, see type SqlCondition
     * @param cache track and cache result if true
     */
    loadMany(model, condition, cache) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
            const schema = this.getSchema(model, true);
            return this.getSession(schema).getMany(schema, condition, cache);
        });
    }
    /**
     * load entity from cache only
     * @param model model name or model type
     * @param key key of entity
     * @returns tracked entity from cache
     */
    get(model, key) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        Common_1.CodeContract.argument("key", () => Common_1.CodeContract.notNull(key));
        const schema = this.getSchema(model, true);
        return this.getSession(schema).getCachedEntity(schema, key);
    }
    /**
     * get all cached entities
     * @param model model name or model type
     * @param filter filter result
     */
    getAll(model, filter) {
        Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
        const schema = this.getSchema(model, true);
        Common_1.CodeContract.argument("model", schema.memCached, "getAll only support for memory model");
        return this.getSession(schema).getAll(schema, filter);
    }
    /**
     * find entities from database
     * @param model model name or model type
     * @param condition query condition, see type SqlCondition
     * @param resultRange limit and offset of results number or json, eg. 10 or {limit: 10, offset 1}
     * @param sort json {propertyName: "ASC" | "DESC"}, eg: {name: "ASC", age: "DESC"}
     * @param properties result properties, default is all properties of model
     * @param join join info
     */
    find(model, condition, resultRange, sort, properties, join) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
            const schema = this.getSchema(model, true);
            return yield this.getSession(schema).query(schema, condition, resultRange, sort, properties, join);
        });
    }
    /**
     * find entities from database
     * @param model mode name or model type
     * @param params mango like query params object
     */
    findOne(model, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const allResult = yield this.findAll(model, params);
            if (allResult.length > 1) {
                const schema = this.getSchema(model, true);
                throw new Error(`many entities found(model=${schema.modelName}, params=${JSON.stringify(params)})`);
            }
            return allResult.length === 0 ? undefined : allResult[0];
        });
    }
    /**
     * find entities from database
     * @param model model name or model type
     * @param params mango like query params object
     */
    findAll(model, params) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
            const schema = this.getSchema(model, true);
            return (yield this.getSession(schema).queryByJson(schema, params));
        });
    }
    /**
     * query if exists entity by specified condition
     * @param model model name or model type
     * @param condition query condition, see type SqlCondition
     */
    exists(model, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
            const schema = this.getSchema(model, true);
            return yield this.getSession(schema).exists(schema, condition);
        });
    }
    /**
     * count entities count by specified condition
     * @param model model name or model type
     * @param condition query condition, see type condition
     */
    count(model, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("model", () => Common_1.CodeContract.notNull(model));
            const schema = this.getSchema(model, true);
            return yield this.getSession(schema).count(schema, condition);
        });
    }
    /**
     * get block header by height
     * @param height block height
     * @param withTransactions result contains transactions, default is false
     * @returns block which height === given height
     */
    getBlockByHeight(height, withTransactions = false) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("height", height >= 0, "height must great or equal zero");
            const entity = this.copyCachedBlock(() => this.cachedBlocks.get(height), withTransactions);
            if (entity !== undefined) {
                return entity;
            }
            const dbBlock = yield this.blockDB.getBlock(height);
            if (!withTransactions || dbBlock === undefined) {
                return dbBlock;
            }
            const queryBlocks = yield this.attachTransactions([dbBlock], () => __awaiter(this, void 0, void 0, function* () {
                return (yield this.blockSession.query(this.transactionSchema, { height: dbBlock.height }));
            }));
            return queryBlocks[0];
        });
    }
    /**
     * get block header by block id
     * @param blockId block id
     * @param withTransactions result contains transactions, default is false
     * @returns block which id === given blockId
     */
    getBlockById(blockId, withTransactions = false) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("blockId", () => Common_1.CodeContract.notNullOrWhitespace(blockId));
            const entity = this.copyCachedBlock(() => this.cachedBlocks.getById(blockId), withTransactions);
            if (entity !== undefined) {
                return entity;
            }
            const dbBlock = yield this.blockDB.getBlockById(blockId);
            if (!withTransactions || dbBlock === undefined) {
                return dbBlock;
            }
            const queryBlocks = yield this.attachTransactions([dbBlock], () => __awaiter(this, void 0, void 0, function* () {
                return (yield this.blockSession.query(this.transactionSchema, { height: dbBlock.height }));
            }));
            return queryBlocks[0];
        });
    }
    /**
     * get block headers by height range
     * @param minHeight min height(included)
     * @param maxHeight max height(included)
     * @param withTransactions result contains transactions default is false
     * @returns block which maxHeight >= height >= minHeight
     */
    getBlockByHeightRange(minHeight, maxHeight, withTransactions = false) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("minHeight, maxHeight", minHeight >= 0 && maxHeight >= minHeight, "minHeight or maxHeight is invalid");
            const blocks = yield this.blockDB.getBlocksByHeightRange(minHeight, maxHeight);
            if (!withTransactions) {
                return blocks;
            }
            const queryBlocks = yield this.attachTransactions(blocks, () => __awaiter(this, void 0, void 0, function* () {
                return (yield this.blockSession.query(this.transactionSchema, { height: { $in: blocks.map(block => block.height) } }));
            }));
            return queryBlocks;
        });
    }
    /**
     * get block headers by block id array
     * @param blockIds array of block id
     * @param withTransactions result contains transactions, default is false
     */
    getBlocksByIds(blockIds, withTransactions = false) {
        return __awaiter(this, void 0, void 0, function* () {
            Common_1.CodeContract.argument("blockIds", () => Common_1.CodeContract.notNull(blockIds));
            const blocks = yield this.blockDB.getBlocksByIds(blockIds);
            if (!withTransactions)
                return blocks;
            const queryBlocks = yield this.attachTransactions(blocks, () => __awaiter(this, void 0, void 0, function* () {
                return (yield this.blockSession.query(this.transactionSchema, { height: { $in: blocks.map(block => block.height) } }));
            }));
            return queryBlocks;
        });
    }
    ////
    get transactionSchema() {
        return this.getSchema(TRANSACTION_MODEL_NAME, true, true);
    }
    getSchema(schema, checkExists = false, checkReadonly = false) {
        const name = typeof schema === "string" ? String(schema) : schema.name;
        const matchedSchema = this.schemas.get(name);
        if (checkExists) {
            Common_1.CodeContract.verify(matchedSchema !== undefined, `unregisterd model '${name}'`);
        }
        if (checkReadonly) {
            Common_1.CodeContract.verify(!(matchedSchema.isReadonly), `model '${name}' is readonly`);
        }
        return matchedSchema;
    }
    loadHistoryFromLevelDB(minHeight, maxHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.blockDB.getHistoryChanges(minHeight, maxHeight);
        });
    }
    getSession(schema) {
        if (schema.isLocal) {
            return this.localSession;
        }
        return this.blockSession;
    }
    syncSchemas(schemas) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const schema of schemas) {
                this.schemas.set(schema.modelName, schema);
                const session = this.getSession(schema);
                session.registerSchema(schema);
                session.syncSchema(schema);
                if (this.log.infoEnabled) {
                    this.log.info(`sync schema model='${schema.modelName}'`);
                }
                if (schema.memCached) {
                    const entities = yield session.getMany(schema, {}, true);
                    if (this.log.infoEnabled) {
                        this.log.info(`model ${schema.modelName} cached ${entities.length} entities`);
                    }
                }
            }
            if (undefined === this.transactionSchema)
                throw new Error("Transaction model is not found");
        });
    }
    copyCachedBlock(func, withTransactions) {
        const block = func();
        if (block === undefined)
            return undefined;
        const copy = Object.assign({}, block);
        if (!withTransactions) {
            Reflect.deleteProperty(copy, "transactions");
        }
        return copy;
    }
    attachTransactions(blocks, func) {
        return __awaiter(this, void 0, void 0, function* () {
            const filterTrs = new Map();
            const relatedTransactions = yield func();
            relatedTransactions
                .forEach(val => {
                if (!filterTrs.has(val.blockId)) {
                    filterTrs.set(val.blockId, []);
                }
                filterTrs.get(val.blockId).push(val);
            });
            blocks.forEach(val => val.transactions = filterTrs.get(val.id));
            return blocks;
        });
    }
    ensureLastBlockLoaded() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.lastBlock === undefined && this.lastBlockHeight >= 0) {
                const block = yield this.getBlockByHeight(this.lastBlockHeight, true);
                if (this.log.infoEnabled) {
                    this.log.info(`SUCCESS load last block(height=${block.height},id=${block.id})`);
                }
                this.cachedBlocks.push(block);
            }
        });
    }
    preCommitBlock(block) {
        this.commitBlockHooks.forEach(val => val.hook(block));
    }
    postCommitBlock(block) {
        this.emit("newBlock", block);
    }
    preRollbackBlock(minHeight, maxHeight) {
        this.rollbackBlockHooks.forEach(val => val.hook(minHeight, maxHeight));
    }
    postRollbackBlock(minHeight, maxHeight) {
        this.emit("rollbackBlock", { form: minHeight, to: maxHeight });
    }
}
exports.SmartDB = SmartDB;

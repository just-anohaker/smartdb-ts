import { EventEmitter } from "events";
import { Block, Transaction } from "./Block";
import { MaybeUndefined, Entity, CodeContract, FilterFunction, JsonObject } from "./Common";
import { ModelSchema, ModelNameOrType, NormalizedEntityKey, EntityKey } from "./Model";
import { Logger, LogManager } from "./Log";
import { LevelBlock } from "./LevelBlock";
import { BlockCache } from "./BlockCache";
import { SqliteConnection } from "./sqldb/SqliteConnection";
import { DbSession } from "./DbSession";
import { DbConnection } from "./sqldb/DbConnection";
import { ChangesHistoryItem } from "./tracker/EntityTracker";
import { Utils } from "./Utils";
import { SqlCondition, SqlResultRange, SqlOrder } from "./sqldb/SqlBuilder";

export type CommitBlockHook = (blocks: Block) => void;
export type RollbackBlockHook = (fromHeight: number, toHeight: number) => void;
export type SmartDBOptions = {
    /**
     * cached history count(block count), used to rollback block
     * @default 10
     */
    maxBlockHistoryHold?: number;

    /**
     * cached last block count
     * @default 10
     */
    cachedBlockCount?: number;

    /**
     * SmartDB will check modifier properties in model if checkModifier is true
     */
    checkModifier?: boolean;
}

const TRANSACTION_MODEL_NAME = "Transaction";

/**
 * ORM like to operate blockchain data
 * @event ready emit after initialized
 * @event close emit after closed
 */
export class SmartDB extends EventEmitter {
    private options: SmartDBOptions;
    private log: Logger;
    private blockDB: LevelBlock;
    private cachedBlocks: BlockCache;
    private connection: DbConnection;
    private blockSession: DbSession;
    private localSession: DbSession;
    private commitBlockHooks: { name: string, hook: CommitBlockHook }[];
    private rollbackBlockHooks: { name: string, hook: RollbackBlockHook }[];
    private schemas: Map<string, ModelSchema<Entity>>;
    private currentBlock?: Block;

    /**
     * Constructor
     * NOTIC: you need call init before use SmartDB
     * @param dbPath: path of blockchain db
     * @param levelBlockDir path of block header db
     * @param options of SmartDB
     */
    constructor(
        dbPath: string,
        levelBlockDir: string,
        options?: SmartDBOptions
    ) {
        super();
        this.commitBlockHooks = [];
        this.rollbackBlockHooks = [];
        this.schemas = new Map();

        CodeContract.argument("dbPath", () => CodeContract.notNullOrWhitespace(dbPath));
        CodeContract.argument("levelBlockDir", () => CodeContract.notNullOrWhitespace(levelBlockDir));
        this.options = options || { cachedBlockCount: 10, maxBlockHistoryHold: 10 };
        this.log = LogManager.getLogger("SmartDB");
        this.blockDB = new LevelBlock(levelBlockDir);
        this.cachedBlocks = new BlockCache(this.options.cachedBlockCount!);
        this.connection = new SqliteConnection({ storage: dbPath });
        this.blockSession = new DbSession(
            this.connection,
            this.loadHistoryFromLevelDB.bind(this),
            { name: "Block" }
        );
        this.localSession = new DbSession(
            this.connection,
            null,
            { name: "Local" }
        );
    }

    /**
     * height of last block
     */
    get lastBlockHeight(): number {
        return this.blockDB.lastBlockHeight;
    }

    /**
     * blocks count
     */
    get blocksCount(): number {
        return this.lastBlockHeight + 1;
    }

    /**
     * last commited block
     */
    get lastBlock(): Block {
        return this.cachedBlocks.get(this.lastBlockHeight)!;
    }

    /**
     * register commit block hook, which will be called before commit block
     * @param name hook name
     * @param hookFunc hook function, (block) => void
     */
    registerCommitBlockHook(name: string, hookFunc: CommitBlockHook): void {
        CodeContract.argument("hookFunc", () => CodeContract.notNull(hookFunc));
        CodeContract.argument("name", () => CodeContract.notNullOrWhitespace(name));
        CodeContract.argument(
            "name",
            this.commitBlockHooks.every(value => value.name !== name.trim()),
            `hook named '${name}' exist already`
        );
        this.commitBlockHooks.push({
            name,
            hook: hookFunc
        });
    }

    /**
     * unregister commit block hook
     * @param name hook name
     */
    unregisterCommitBlockHook(name: string): void {
        CodeContract.argument("name", () => CodeContract.notNullOrWhitespace(name));
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
    registerRollbackBlockHook(name: string, hookFunc: RollbackBlockHook): void {
        CodeContract.argument("hookFunc", () => CodeContract.notNull(hookFunc));
        CodeContract.argument("name", () => CodeContract.notNullOrWhitespace(name));
        CodeContract.argument(
            "name",
            this.rollbackBlockHooks.some(val => val.name === name.trim()),
            `hook named '${name}' exist already`
        );
        this.rollbackBlockHooks.push({
            name,
            hook: hookFunc
        });
    }

    /**
     * unregister rollback block hook
     * @param name hook name
     */
    unregisterRollbackBlockHook(name: string): void {
        CodeContract.argument("name", () => CodeContract.notNullOrWhitespace(name));
        const findIdx = this.rollbackBlockHooks.findIndex(val => val.name === name.trim());
        if (findIdx >= 0) {
            this.rollbackBlockHooks.slice(findIdx);
        }
    }

    /**
     * initialize SmartDB, you need call this before use SmartDB
     * @param schemas table schema in Database
     */
    async init(schemas: ModelSchema<Entity>[]): Promise<void> {
        CodeContract.argument("schemas", () => CodeContract.notNull(schemas));
        await this.connection.connect();
        await this.blockDB.open();
        await this.syncSchemas(schemas);
        await this.ensureLastBlockLoaded();
        await this.blockSession.initSerial(this.blockDB.lastBlockHeight);
        await this.localSession.initSerial(-1);
        this.emit("ready", this);
    }

    /**
     * update schema, NOTIC: table must be empty!!!
     * @param schema schema
     */
    async updateSchema(schema: ModelSchema<Entity>): Promise<void> {
        CodeContract.argument("schema", () => CodeContract.notNull(schema));
        const newSchema = this.getSchema(schema.modelName);
        const session = this.getSession(newSchema!);
        await session.updateSchema(schema);
        if (this.log.infoEnabled) {
            this.log.info(`model ${schema.modelName} schema updated`);
        }
    }

    /**
     * free resources
     */
    async close(): Promise<void> {
        await this.blockSession.close();
        await this.localSession.close();
        await this.blockDB.close();
        this.emit("closed", this);
    }

    /**
     * hold a lock name which only succeed in first time of each block
     * @param lockName lock name
     * @param notThrow do not throw exception if lock failed
     * @throws lock failed if lockName exists already and notThrow is false
     */
    lockInCurrentBlock(lockName: string, notThrow: boolean = false): boolean {
        return this.blockSession.lockInThisSession(lockName, notThrow);
    }

    /**
     * hold a lock name which only succeed in first time of each block
     * @param lockName lock name
     * @throws lock failed if lockName exists already
     */
    lock(lockName: string): void {
        this.lockInCurrentBlock(lockName, false);
    }

    /**
     * hold a lock name which only succeed if first time of each block
     * @param lockName lock name
     * @throws true if lock succeed else false
     */
    tryLock(lockName: string): boolean {
        return this.lockInCurrentBlock(lockName, true);
    }

    /**
     * begin a contract transaction which effect entities in memory
     */
    beginContract(): void {
        this.blockSession.beginEntityTransaction();
    }

    /**
     * commit entities changes, these changes will be save into database when block forged
     */
    commitContract(): void {
        this.blockSession.commitEntityTransaction();
    }

    /**
     * rollback entities changes in memory
     */
    rollbackContract(): void {
        this.blockSession.rollbackEntityTransaction();
    }

    /**
     * begin a new block
     * @param block 
     */
    beginBlock(block: Block): void {
        CodeContract.argument("block", () => CodeContract.notNull(block));
        CodeContract.argument(
            "block",
            block.height === this.lastBlockHeight + 1,
            `invalid block height ${block.height}, last=${this.lastBlockHeight}`
        );
        if (this.log.infoEnabled) {
            this.log.info(`BEGIN block height=${block.height}`);
        }
        this.currentBlock = block;
    }

    /**
     * commit block changes
     */
    async commitBlock(): Promise<number> {
        if (!this.currentBlock) {
            throw new Error("Current block is null");
        }
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN commitBlock height=${this.currentBlock.height}`);
        }
        this.preCommitBlock(this.currentBlock);
        const copyBlock = Object.assign({}, this.currentBlock);
        Reflect.deleteProperty(copyBlock, "transactions");
        Utils.Performance.time("Append block");
        await this.blockDB.appendBlock(copyBlock, this.blockSession.getChanges());
        Utils.Performance.endTime(false);
        try {
            await this.blockSession.saveChanges(this.currentBlock.height);
            this.cachedBlocks.push(this.currentBlock);
            this.currentBlock = undefined;
            this.postCommitBlock(this.lastBlock);
            if (this.log.infoEnabled) {
                this.log.info(`SUCCESS commitBlock height=${this.lastBlockHeight}`);
            }
            return this.lastBlockHeight;
        } catch (error) {
            if (this.log.errorEnabled) {
                this.log.error(`FAILED commitBlock (height=${this.currentBlock!.height})`, error);
            }
            await this.blockDB.deleteLastBlock(this.currentBlock!.height);
            throw error;
        }
    }

    /**
     * rollback block changes
     * @param height rollback to height(excluded)
     */
    async rollbackBlock(height?: number): Promise<void> {
        CodeContract.argument(
            "height",
            !height || height <= this.lastBlockHeight,
            `height must less or equal lastBlockHeight ${this.lastBlockHeight}`
        );
        const currentHeight = this.currentBlock ? this.currentBlock.height : this.lastBlockHeight;
        const argHeight = height === undefined ? this.lastBlockHeight : height;
        if (this.log.traceEnabled) {
            this.log.trace(`BEGIN rollbackBlock (height: ${currentHeight} -> ${argHeight})`);
        }
        this.preRollbackBlock(currentHeight, argHeight);
        try {
            await this.blockSession.rollbackChanges(argHeight);
            while (this.lastBlockHeight > argHeight) {
                await this.blockDB.deleteLastBlock(this.lastBlockHeight);
                this.cachedBlocks.evitUntil(this.lastBlockHeight);
            }
            await this.ensureLastBlockLoaded();
            this.currentBlock = undefined;
            this.postRollbackBlock(currentHeight, argHeight);
            if (this.log.infoEnabled) {
                this.log.info(`SUCCESS rollbackBlock (height: ${currentHeight} -> ${argHeight})`);
            }
        } catch (error) {
            if (this.log.errorEnabled) {
                this.log.error(`FAILED rollbackBlock (height: ${currentHeight} -> ${argHeight})`, error);
            }
            throw error;
        }
    }

    /**
     * save changes of local tables (not in block --- which define in schema by local: true) into database
     * @returns serial number for changes
     */
    async saveLocalChanges(): Promise<number> {
        return await this.localSession.saveChanges();
    }

    /**
     * rollback local tables changes saveLocalChanges
     * @param serial serial number return from saveLocalChanges
     */
    async rollbackLocalChanges(serial: number): Promise<void> {
        CodeContract.argument("serial", serial >= 0, "serial must great or equal zero");
        await this.localSession.rollbackChanges(serial);
    }

    /**
     * create a new entity which change will be tracked and persistented (by saveChanges) automatically
     * @param model modelName or model type
     * @param entity prototype entity which properties will copy to result entity
     * @returns tracking entity
     */
    create<T extends object>(model: ModelNameOrType<T>, entity: Partial<T>): T {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("entity", () => CodeContract.notNull(entity));
        const schema = this.getSchema(model, true, true)!;
        return this.getSession(schema).create<T>(schema as any, entity);
    }

    createOrLoad<T extends object>(model: ModelNameOrType<T>, entity: T): { create: boolean; entity: T } {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("entity", () => CodeContract.notNull(entity));
        const schema = this.getSchema(model, true, true)!;
        const val: MaybeUndefined<T> = this.loadSync(model, schema.getNormalizedPrimaryKey(entity)) as any;
        return {
            create: val === undefined,
            entity: val || this.create(model, entity)
        };
    }

    increase<T extends object>(model: ModelNameOrType<T>, increasements: Partial<T>, key: NormalizedEntityKey<T>): Partial<T> {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("increasements", () => CodeContract.notNull(increasements));
        CodeContract.argument("key", () => CodeContract.notNull(key));

        const schema = this.getSchema(model, true, true)!;
        return this.getSession(schema).increase(schema, key, increasements) as any;
    }

    /**
     * update a entity
     * @param model modelName or model type
     * @param modifier primary key of entity or partial entity with primary key property(s)
     * @param key json modifier, keyOrEntity properties used as modifier if not given
     */
    update<T extends object>(model: ModelNameOrType<T>, modifier: Partial<T>, key: NormalizedEntityKey<T>): void {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("modifier", () => CodeContract.notNull(modifier));
        CodeContract.argument("key", () => CodeContract.notNull(key));

        const schema = this.getSchema(model, true, true)!
        if (this.options.checkModifier === true) {
            const keys = Object.keys(modifier);
            const without = Utils.Array.without(schema.properties, ...keys);
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
    del<T extends object>(model: ModelNameOrType<T>, key: NormalizedEntityKey<T>): void {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("key", () => CodeContract.notNull(key));

        const schema = this.getSchema(model, true, true)!;
        this.getSession(schema).delete(schema, key);
    }

    /**
     * load entity from cache and database
     * @param model model name or model type
     * @param key key of entity
     */
    async load<T extends object>(model: ModelNameOrType<T>, key: EntityKey<T>): Promise<MaybeUndefined<T>> {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("key", () => CodeContract.notNull(key));

        const schema = this.getSchema(model, true)!;
        return (await this.getSession(schema).load(schema, key)) as any;
    }

    loadSync<T extends object>(model: ModelNameOrType<T>, key: EntityKey<T>): MaybeUndefined<T> {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("key", () => CodeContract.notNull(key));
        const schema = this.getSchema(model, true)!;
        return (this.getSession(schema).loadSync(schema, key)) as any;
    }

    /**
     * get entities from database
     * @param model model name or model type
     * @param condition find condition, see type SqlCondition
     * @param cache track and cache result if true
     */
    async loadMany<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition, cache?: boolean): Promise<T[]> {
        CodeContract.argument("model", () => CodeContract.notNull(model));

        const schema = this.getSchema(model, true)!;
        return this.getSession(schema).getMany(schema, condition, cache) as any;
    }

    /**
     * load entity from cache only
     * @param model model name or model type
     * @param key key of entity
     * @returns tracked entity from cache
     */
    get<T extends object>(model: ModelNameOrType<T>, key: EntityKey<T>): MaybeUndefined<T> {
        CodeContract.argument("model", () => CodeContract.notNull(model));
        CodeContract.argument("key", () => CodeContract.notNull(key));

        const schema = this.getSchema(model, true)!;
        return this.getSession(schema).getCachedEntity(schema, key) as any;
    }

    /**
     * get all cached entities
     * @param model model name or model type
     * @param filter filter result
     */
    getAll<T extends Entity>(model: ModelNameOrType<T>, filter?: FilterFunction<T>): T[] {
        CodeContract.argument("model", () => CodeContract.notNull(model));

        const schema = this.getSchema(model, true)!;
        CodeContract.argument("model", schema.memCached, "getAll only support for memory model");
        return this.getSession(schema).getAll(schema, filter as any) as any;
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
    async find<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, properties?: string[], join?: JsonObject): Promise<Entity[]> {
        CodeContract.argument("model", () => CodeContract.notNull(model));

        const schema = this.getSchema(model, true)!;

        return await this.getSession(schema).query(schema, condition, resultRange, sort, properties, join);
    }

    /**
     * find entities from database
     * @param model mode name or model type
     * @param params mango like query params object
     */
    async findOne<T extends object>(model: ModelNameOrType<T>, params: JsonObject): Promise<MaybeUndefined<T>> {
        const allResult = await this.findAll(model, params);
        if (allResult.length > 1) {
            const schema = this.getSchema(model, true)!;
            throw new Error(`many entities found(model=${schema.modelName}, params=${JSON.stringify(params)})`);
        }
        return allResult.length === 0 ? undefined : allResult[0];
    }

    /**
     * find entities from database
     * @param model model name or model type
     * @param params mango like query params object
     */
    async findAll<T extends object>(model: ModelNameOrType<T>, params: JsonObject): Promise<T[]> {
        CodeContract.argument("model", () => CodeContract.notNull(model));

        const schema = this.getSchema(model, true)!;
        return (await this.getSession(schema).queryByJson(schema, params)) as any;
    }

    /**
     * query if exists entity by specified condition
     * @param model model name or model type
     * @param condition query condition, see type SqlCondition
     */
    async exists<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition): Promise<boolean> {
        CodeContract.argument("model", () => CodeContract.notNull(model));

        const schema = this.getSchema(model, true)!;
        return await this.getSession(schema).exists(schema, condition);
    }

    /**
     * count entities count by specified condition
     * @param model model name or model type
     * @param condition query condition, see type condition
     */
    async count<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition): Promise<number> {
        CodeContract.argument("model", () => CodeContract.notNull(model));

        const schema = this.getSchema(model, true)!;
        return await this.getSession(schema).count(schema, condition);
    }

    /**
     * get block header by height
     * @param height block height
     * @param withTransactions result contains transactions, default is false
     * @returns block which height === given height
     */
    async getBlockByHeight(height: number, withTransactions: boolean = false): Promise<MaybeUndefined<Block>> {
        CodeContract.argument("height", height >= 0, "height must great or equal zero");
        const entity = this.copyCachedBlock(() => this.cachedBlocks.get(height), withTransactions);
        if (entity !== undefined) {
            return entity;
        }

        const dbBlock = await this.blockDB.getBlock(height);
        if (!withTransactions || dbBlock === undefined) {
            return dbBlock;
        }

        const queryBlocks = await this.attachTransactions([dbBlock], async () => (await this.blockSession.query(
            this.transactionSchema!,
            { height: dbBlock.height }
        )) as any);
        return queryBlocks[0];
    }

    /**
     * get block header by block id
     * @param blockId block id
     * @param withTransactions result contains transactions, default is false
     * @returns block which id === given blockId
     */
    async getBlockById(blockId: string, withTransactions: boolean = false): Promise<MaybeUndefined<Block>> {
        CodeContract.argument("blockId", () => CodeContract.notNullOrWhitespace(blockId));

        const entity = this.copyCachedBlock(() => this.cachedBlocks.getById(blockId), withTransactions)
        if (entity !== undefined) {
            return entity;
        }

        const dbBlock = await this.blockDB.getBlockById(blockId);
        if (!withTransactions || dbBlock === undefined) {
            return dbBlock;
        }

        const queryBlocks = await this.attachTransactions([dbBlock], async () => (await this.blockSession.query(
            this.transactionSchema!,
            { height: dbBlock.height }
        )) as any);
        return queryBlocks[0];
    }

    /**
     * get block headers by height range
     * @param minHeight min height(included)
     * @param maxHeight max height(included)
     * @param withTransactions result contains transactions default is false
     * @returns block which maxHeight >= height >= minHeight
     */
    async getBlockByHeightRange(minHeight: number, maxHeight: number, withTransactions: boolean = false): Promise<Block[]> {
        CodeContract.argument("minHeight, maxHeight", minHeight >= 0 && maxHeight >= minHeight, "minHeight or maxHeight is invalid");

        const blocks = await this.blockDB.getBlocksByHeightRange(minHeight, maxHeight);
        if (!withTransactions) {
            return blocks;
        }

        const queryBlocks = await this.attachTransactions(blocks, async () => (await this.blockSession.query(
            this.transactionSchema!,
            { height: { $in: blocks.map(block => block.height) } }
        )) as any);
        return queryBlocks;
    }

    /**
     * get block headers by block id array
     * @param blockIds array of block id
     * @param withTransactions result contains transactions, default is false
     */
    async getBlocksByIds(blockIds: string[], withTransactions: boolean = false): Promise<Block[]> {
        CodeContract.argument("blockIds", () => CodeContract.notNull(blockIds));

        const blocks = await this.blockDB.getBlocksByIds(blockIds);
        if (!withTransactions) return blocks;

        const queryBlocks = await this.attachTransactions(blocks, async () => (await this.blockSession.query(
            this.transactionSchema!,
            { height: { $in: blocks.map(block => block.height) } }
        )) as any);
        return queryBlocks;
    }

    ////
    private get transactionSchema(): MaybeUndefined<ModelSchema<Entity>> {
        return this.getSchema(TRANSACTION_MODEL_NAME, true, true);
    }

    private getSchema(schema: string | { name: string }, checkExists: boolean = false, checkReadonly: boolean = false): MaybeUndefined<ModelSchema<Entity>> {
        const name = typeof schema === "string" ? String(schema) : schema.name;
        const matchedSchema = this.schemas.get(name);
        if (checkExists) {
            CodeContract.verify(matchedSchema !== undefined, `unregisterd model '${name}'`);
        }
        if (checkReadonly) {
            CodeContract.verify(!(matchedSchema!.isReadonly), `model '${name}' is readonly`);
        }
        return matchedSchema;
    }

    private async loadHistoryFromLevelDB(minHeight: number, maxHeight: number): Promise<Map<number, Array<ChangesHistoryItem<Entity>>>> {
        return await this.blockDB.getHistoryChanges(minHeight, maxHeight);
    }

    private getSession(schema: ModelSchema<Entity>): DbSession {
        if (schema.isLocal) {
            return this.localSession;
        }
        return this.blockSession;
    }

    private async syncSchemas(schemas: ModelSchema<Entity>[]): Promise<void> {
        for (const schema of schemas) {
            this.schemas.set(schema.modelName, schema);
            const session = this.getSession(schema);
            session.registerSchema(schema);
            session.syncSchema(schema);
            if (this.log.infoEnabled) {
                this.log.info(`sync schema model='${schema.modelName}'`);
            }
            if (schema.memCached) {
                const entities: Entity[] = await session.getMany<Entity>(schema, {}, true);
                if (this.log.infoEnabled) {
                    this.log.info(`model ${schema.modelName} cached ${entities.length} entities`);
                }
            }
        }
        if (undefined === this.transactionSchema) throw new Error("Transaction model is not found");
    }

    private copyCachedBlock(func: () => MaybeUndefined<Block>, withTransactions: boolean): MaybeUndefined<Block> {
        const block = func();
        if (block === undefined) return undefined;

        const copy = Object.assign({}, block);
        if (!withTransactions) {
            Reflect.deleteProperty(copy, "transactions");
        }
        return copy;
    }

    private async attachTransactions(blocks: Block[], func: () => Promise<Transaction[]>): Promise<Block[]> {
        const filterTrs: Map<string, Transaction[]> = new Map();
        const relatedTransactions = await func();
        relatedTransactions
            .forEach(val => {
                if (!filterTrs.has(val.blockId)) {
                    filterTrs.set(val.blockId, []);
                }
                filterTrs.get(val.blockId)!.push(val);
            });
        blocks.forEach(val => val.transactions = filterTrs.get(val.id!));
        return blocks;
    }

    private async ensureLastBlockLoaded(): Promise<void> {
        if (this.lastBlock === undefined && this.lastBlockHeight >= 0) {
            const block = await this.getBlockByHeight(this.lastBlockHeight, true);
            if (this.log.infoEnabled) {
                this.log.info(`SUCCESS load last block(height=${block!.height},id=${block!.id})`);
            }
            this.cachedBlocks.push(block!);
        }
    }

    private preCommitBlock(block: Block): void {
        this.commitBlockHooks.forEach(val => val.hook(block));
    }

    private postCommitBlock(block: Block): void {
        this.emit("newBlock", block);
    }

    private preRollbackBlock(minHeight: number, maxHeight: number): void {
        this.rollbackBlockHooks.forEach(val => val.hook(minHeight, maxHeight));
    }

    private postRollbackBlock(minHeight: number, maxHeight: number): void {
        this.emit("rollbackBlock", { form: minHeight, to: maxHeight });
    }
}
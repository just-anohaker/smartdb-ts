/// <reference types="node" />
import { EventEmitter } from "events";
import { Block } from "./Block";
import { MaybeUndefined, Entity, FilterFunction, JsonObject } from "./Common";
import { ModelSchema, ModelNameOrType, NormalizedEntityKey, EntityKey } from "./Model";
import { SqlCondition, SqlResultRange, SqlOrder } from "./sqldb/SqlBuilder";
export declare type CommitBlockHook = (blocks: Block) => void;
export declare type RollbackBlockHook = (fromHeight: number, toHeight: number) => void;
export declare type SmartDBOptions = {
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
};
/**
 * ORM like to operate blockchain data
 * @event ready emit after initialized
 * @event close emit after closed
 */
export declare class SmartDB extends EventEmitter {
    private options;
    private log;
    private blockDB;
    private cachedBlocks;
    private connection;
    private blockSession;
    private localSession;
    private commitBlockHooks;
    private rollbackBlockHooks;
    private schemas;
    private currentBlock?;
    /**
     * Constructor
     * NOTIC: you need call init before use SmartDB
     * @param dbPath: path of blockchain db
     * @param levelBlockDir path of block header db
     * @param options of SmartDB
     */
    constructor(dbPath: string, levelBlockDir: string, options?: SmartDBOptions);
    /**
     * height of last block
     */
    readonly lastBlockHeight: number;
    /**
     * blocks count
     */
    readonly blocksCount: number;
    /**
     * last commited block
     */
    readonly lastBlock: Block;
    /**
     * register commit block hook, which will be called before commit block
     * @param name hook name
     * @param hookFunc hook function, (block) => void
     */
    registerCommitBlockHook(name: string, hookFunc: CommitBlockHook): void;
    /**
     * unregister commit block hook
     * @param name hook name
     */
    unregisterCommitBlockHook(name: string): void;
    /**
     * register rollback block hook, whick will be called before commit block
     * @param name hook name
     * @param hookFunc hook function, (fromHeight, toHeight) => void
     */
    registerRollbackBlockHook(name: string, hookFunc: RollbackBlockHook): void;
    /**
     * unregister rollback block hook
     * @param name hook name
     */
    unregisterRollbackBlockHook(name: string): void;
    /**
     * initialize SmartDB, you need call this before use SmartDB
     * @param schemas table schema in Database
     */
    init(schemas: ModelSchema<Entity>[]): Promise<void>;
    /**
     * update schema, NOTIC: table must be empty!!!
     * @param schema schema
     */
    updateSchema(schema: ModelSchema<Entity>): Promise<void>;
    /**
     * free resources
     */
    close(): Promise<void>;
    /**
     * hold a lock name which only succeed in first time of each block
     * @param lockName lock name
     * @param notThrow do not throw exception if lock failed
     * @throws lock failed if lockName exists already and notThrow is false
     */
    lockInCurrentBlock(lockName: string, notThrow?: boolean): boolean;
    /**
     * hold a lock name which only succeed in first time of each block
     * @param lockName lock name
     * @throws lock failed if lockName exists already
     */
    lock(lockName: string): void;
    /**
     * hold a lock name which only succeed if first time of each block
     * @param lockName lock name
     * @throws true if lock succeed else false
     */
    tryLock(lockName: string): boolean;
    /**
     * begin a contract transaction which effect entities in memory
     */
    beginContract(): void;
    /**
     * commit entities changes, these changes will be save into database when block forged
     */
    commitContract(): void;
    /**
     * rollback entities changes in memory
     */
    rollbackContract(): void;
    /**
     * begin a new block
     * @param block
     */
    beginBlock(block: Block): void;
    /**
     * commit block changes
     */
    commitBlock(): Promise<number>;
    /**
     * rollback block changes
     * @param height rollback to height(excluded)
     */
    rollbackBlock(height?: number): Promise<void>;
    /**
     * save changes of local tables (not in block --- which define in schema by local: true) into database
     * @returns serial number for changes
     */
    saveLocalChanges(): Promise<number>;
    /**
     * rollback local tables changes saveLocalChanges
     * @param serial serial number return from saveLocalChanges
     */
    rollbackLocalChanges(serial: number): Promise<void>;
    /**
     * create a new entity which change will be tracked and persistented (by saveChanges) automatically
     * @param model modelName or model type
     * @param entity prototype entity which properties will copy to result entity
     * @returns tracking entity
     */
    create<T extends object>(model: ModelNameOrType<T>, entity: Partial<T>): T;
    createOrLoad<T extends object>(model: ModelNameOrType<T>, entity: T): {
        create: boolean;
        entity: T;
    };
    increase<T extends object>(model: ModelNameOrType<T>, increasements: Partial<T>, key: NormalizedEntityKey<T>): Partial<T>;
    /**
     * update a entity
     * @param model modelName or model type
     * @param modifier primary key of entity or partial entity with primary key property(s)
     * @param key json modifier, keyOrEntity properties used as modifier if not given
     */
    update<T extends object>(model: ModelNameOrType<T>, modifier: Partial<T>, key: NormalizedEntityKey<T>): void;
    /**
     * delete a entity
     * @param model modelName or model type
     * @param key primaryKey of entity
     */
    del<T extends object>(model: ModelNameOrType<T>, key: NormalizedEntityKey<T>): void;
    /**
     * load entity from cache and database
     * @param model model name or model type
     * @param key key of entity
     */
    load<T extends object>(model: ModelNameOrType<T>, key: EntityKey<T>): Promise<MaybeUndefined<T>>;
    loadSync<T extends object>(model: ModelNameOrType<T>, key: EntityKey<T>): MaybeUndefined<T>;
    /**
     * get entities from database
     * @param model model name or model type
     * @param condition find condition, see type SqlCondition
     * @param cache track and cache result if true
     */
    loadMany<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition, cache?: boolean): Promise<T[]>;
    /**
     * load entity from cache only
     * @param model model name or model type
     * @param key key of entity
     * @returns tracked entity from cache
     */
    get<T extends object>(model: ModelNameOrType<T>, key: EntityKey<T>): MaybeUndefined<T>;
    /**
     * get all cached entities
     * @param model model name or model type
     * @param filter filter result
     */
    getAll<T extends Entity>(model: ModelNameOrType<T>, filter?: FilterFunction<T>): T[];
    /**
     * find entities from database
     * @param model model name or model type
     * @param condition query condition, see type SqlCondition
     * @param resultRange limit and offset of results number or json, eg. 10 or {limit: 10, offset 1}
     * @param sort json {propertyName: "ASC" | "DESC"}, eg: {name: "ASC", age: "DESC"}
     * @param properties result properties, default is all properties of model
     * @param join join info
     */
    find<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition, resultRange?: SqlResultRange, sort?: SqlOrder, properties?: string[], join?: JsonObject): Promise<Entity[]>;
    /**
     * find entities from database
     * @param model mode name or model type
     * @param params mango like query params object
     */
    findOne<T extends object>(model: ModelNameOrType<T>, params: JsonObject): Promise<MaybeUndefined<T>>;
    /**
     * find entities from database
     * @param model model name or model type
     * @param params mango like query params object
     */
    findAll<T extends object>(model: ModelNameOrType<T>, params: JsonObject): Promise<T[]>;
    /**
     * query if exists entity by specified condition
     * @param model model name or model type
     * @param condition query condition, see type SqlCondition
     */
    exists<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition): Promise<boolean>;
    /**
     * count entities count by specified condition
     * @param model model name or model type
     * @param condition query condition, see type condition
     */
    count<T extends object>(model: ModelNameOrType<T>, condition: SqlCondition): Promise<number>;
    /**
     * get block header by height
     * @param height block height
     * @param withTransactions result contains transactions, default is false
     * @returns block which height === given height
     */
    getBlockByHeight(height: number, withTransactions?: boolean): Promise<MaybeUndefined<Block>>;
    /**
     * get block header by block id
     * @param blockId block id
     * @param withTransactions result contains transactions, default is false
     * @returns block which id === given blockId
     */
    getBlockById(blockId: string, withTransactions?: boolean): Promise<MaybeUndefined<Block>>;
    /**
     * get block headers by height range
     * @param minHeight min height(included)
     * @param maxHeight max height(included)
     * @param withTransactions result contains transactions default is false
     * @returns block which maxHeight >= height >= minHeight
     */
    getBlockByHeightRange(minHeight: number, maxHeight: number, withTransactions?: boolean): Promise<Block[]>;
    /**
     * get block headers by block id array
     * @param blockIds array of block id
     * @param withTransactions result contains transactions, default is false
     */
    getBlocksByIds(blockIds: string[], withTransactions?: boolean): Promise<Block[]>;
    private readonly transactionSchema;
    private getSchema;
    private loadHistoryFromLevelDB;
    private getSession;
    private syncSchemas;
    private copyCachedBlock;
    private attachTransactions;
    private ensureLastBlockLoaded;
    private preCommitBlock;
    private postCommitBlock;
    private preRollbackBlock;
    private postRollbackBlock;
}

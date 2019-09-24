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
const LevelDB_1 = require("./kvdb/LevelDB");
const keyLastBlockHeight = "__last_block_height__";
class LevelBlock {
    constructor(dir, levelOptions = {}) {
        const blkSubLevelMeta = new LevelDB_1.SubLevelMeta("blk", "height", [
            { fieldName: "id" },
            { fieldName: "delegate" }
        ]);
        const hisSubLevelMeta = new LevelDB_1.SubLevelMeta("his", "height", []);
        this.db = new LevelDB_1.LevelDB(dir, [blkSubLevelMeta, hisSubLevelMeta], levelOptions);
        this.lastHeight = -1;
    }
    open() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.open();
            this.blockDb = this.db.getSubLevel("blk");
            this.historyDb = this.db.getSubLevel("his");
            this.lastHeight = yield this.getLastBlockHeightFromDb();
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.close();
        });
    }
    get lastBlockHeight() {
        return this.lastHeight;
    }
    appendBlock(block, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!block || !block.id || !block.delegate || block.height === undefined) {
                throw new Error("Invalid block data");
            }
            yield this.historyDb.put(block.height, changes);
            yield this.blockDb.batch([
                {
                    type: "put",
                    key: block.height,
                    value: block
                },
                {
                    type: "put",
                    key: keyLastBlockHeight,
                    value: this.getLastHeightJson(block.height)
                }
            ]);
            this.lastHeight = block.height;
        });
    }
    getBlock(height) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.blockDb.get(height);
            }
            catch (error) {
                if (!this.isKeyNotFoundError(error)) {
                    throw error;
                }
            }
            return undefined;
        });
    }
    getHistoryChanges(minHeight, maxHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = new Map();
            for (let iter = minHeight; iter <= maxHeight; iter++) {
                const resp = yield this.historyDb.get(iter);
                if (resp !== undefined) {
                    result.set(iter, resp);
                }
            }
            return result;
        });
    }
    deleteLastBlock(height) {
        return __awaiter(this, void 0, void 0, function* () {
            if (height !== this.lastBlockHeight) {
                throw new Error(`invalid last block height '${height}`);
            }
            yield this.blockDb.batch([
                {
                    type: "del",
                    key: height
                },
                {
                    type: "put",
                    key: keyLastBlockHeight,
                    value: this.getLastHeightJson(height - 1)
                }
            ]);
            yield this.historyDb.del(height);
            this.lastHeight--;
        });
    }
    getBlockById(blockId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.blockDb.getBy("id", blockId, undefined);
        });
    }
    getBlocksByHeightRange(minHeight, maxHeight) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (let i = minHeight; i <= maxHeight; i++) {
                const block = yield this.getBlock(i);
                if (block !== undefined) {
                    results.push(block);
                }
            }
            return results;
        });
    }
    getBlocksByIds(blockIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (let i = 0; i < blockIds.length; i++) {
                const block = yield this.getBlockById(blockIds[i]);
                if (block !== undefined) {
                    results.push(block);
                }
            }
            return results;
        });
    }
    ////
    getLastHeightJson(height) {
        return {
            height,
            id: "NULL",
            delegate: "NULL"
        };
    }
    getLastBlockHeightFromDb() {
        return __awaiter(this, void 0, void 0, function* () {
            let resp = yield this.blockDb.get(keyLastBlockHeight, {});
            if (resp === undefined) {
                resp = this.getLastHeightJson(-1);
                yield this.blockDb.put(keyLastBlockHeight, resp);
            }
            return resp.height;
        });
    }
    isKeyNotFoundError(error) {
        return "NotFoundError" === error.name;
    }
}
exports.LevelBlock = LevelBlock;

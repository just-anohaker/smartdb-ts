"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BasicEntityTracker_1 = require("./BasicEntityTracker");
const Log_1 = require("../Log");
class SnapshotEntityTracker extends BasicEntityTracker_1.BasicEntityTracker {
    constructor(cache, schemas, maxHistoryVersionsHold, doLoadHistory) {
        super(cache, schemas, maxHistoryVersionsHold, Log_1.LogManager.getLogger("SnapshotEntityTracker"), doLoadHistory);
    }
}
exports.SnapshotEntityTracker = SnapshotEntityTracker;

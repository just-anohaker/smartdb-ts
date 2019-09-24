import { EntityTracker } from "./EntityTracker";
import { BasicEntityTracker, LoadChangesHistoryAction } from "./BasicEntityTracker";
import { EntityCache } from "../cache/EntityCache";
import { ModelSchema } from "../Model";
import { Entity } from "../Common";
export declare class SnapshotEntityTracker extends BasicEntityTracker implements EntityTracker {
    constructor(cache: EntityCache, schemas: Map<string, ModelSchema<Entity>>, maxHistoryVersionsHold: number, doLoadHistory?: LoadChangesHistoryAction);
}

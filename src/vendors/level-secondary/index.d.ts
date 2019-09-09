declare namespace level_secondary {
    interface Secondary {
        get<T>(key: any, options?: {}, callback?: Function): T;
        del(key: any, options?: {}, callback?: Function): void;
        createValueStream(): NodeJS.ReadableStream;
        createKeyStream(): NodeJS.ReadableStream;
        createReadStream(): NodeJS.ReadableStream;
    }

    interface SecondaryConstructor {
        (db: any, fieldName: string, reduce?: Function): Secondary;
        new(db: any, filedName: string, reduce?: Function): Secondary;
    }
}
declare const level_secondary: level_secondary.SecondaryConstructor;

declare module "level-secondary" {
    export = level_secondary;
}
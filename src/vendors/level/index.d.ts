declare namespace level {
    interface Level {
        open(callback?: Function): Promise<any> | undefined;
        close(callback?: Function): Promise<any> | undefined;
        isOpen(): boolean;
        isClosed(): boolean;

        get(key: any): Promise<any>;
        get(key: any, options: {}): Promise<any>;
        get(key: any, callback: Function): void;
        get(key: any, options: {}, callback: Function): void;

        put(key: any, value: any): Promise<void>;
        put(key: any, value: any, options: {}): Promise<void>;
        put(key: any, value: any, callback: Function): void;
        put(key: any, value: any, options: {}, callback: Function): void;

        del(key: any): Promise<void>;
        del(key: any, options: {}): Promise<void>;
        del(key: any, callback: Function): void;
        del(key: any, options: {}, callback: Function): void;

        batch(arr: any[]): Promise<void>;
        batch(arr: any[], options: {}): Promise<void>;
        batch(arr: any[], callback: Function): void;
        batch(arr: any[], options: {}, callback: Function): void;
    }

    interface LevelConstructor {
        (location: string, options?: {}): Level;
        new(location: string, options?: {}): Level;
    }
}
declare const level: level.LevelConstructor;

declare module "level" {
    export = level;
}
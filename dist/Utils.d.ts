export declare class PerformanceHelper {
    private traceName;
    private uptime;
    private isEnabled;
    private doTime;
    private doEndTime;
    private doRestartTime;
    constructor();
    readonly time: (name: string) => void;
    readonly endTime: (continued: boolean) => void;
    readonly restartTime: (name: string) => void;
    enabled: boolean;
}
export declare class Utils {
    static readonly Performance: PerformanceHelper;
    static readonly Array: {
        [name: string]: any;
    };
    static readonly String: {
        [name: string]: any;
    };
    static readonly Collection: {
        [name: string]: any;
    };
    static readonly Function: {
        [name: string]: any;
    };
    static readonly Object: {
        [name: string]: any;
    };
    static readonly Lang: {
        [name: string]: any;
    };
}
export default Utils;

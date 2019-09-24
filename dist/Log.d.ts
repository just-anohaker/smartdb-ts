export declare enum LogLevel {
    All = 127,
    Trace = 64,
    Debug = 32,
    Log = 16,
    Info = 8,
    Warn = 4,
    Error = 2,
    Fatal = 1,
    None = 0
}
export interface IConsole {
    info(msg: string, ...params: any[]): void;
    debug(msg: string, ...params: any[]): void;
    warn(msg: string, ...params: any[]): void;
    error(msg: string, ...params: any[]): void;
}
export interface Logger {
    logLevel: LogLevel;
    readonly infoEnabled: boolean;
    readonly traceEnabled: boolean;
    readonly logEnabled: boolean;
    readonly debugEnabled: boolean;
    readonly warnEnabled: boolean;
    readonly errorEnabled: boolean;
    readonly fatalEnabled: boolean;
    trace(msg: string, ...params: any[]): void;
    debug(msg: string, ...params: any[]): void;
    log(msg: string, ...params: any[]): void;
    info(msg: string, ...params: any[]): void;
    warn(msg: string, ...params: any[]): void;
    error(msg: string, err: Error): void;
    fatal(msg: string, err: Error): void;
}
export interface LogFactory {
    createLog: (name: string) => Logger;
    getLevel: () => LogLevel;
    format: boolean;
}
export declare class LogManager {
    private static consoleLogger;
    private static defaultLogLevel;
    private static factory;
    static readonly defaultLogger: Logger;
    static defaultLevel: LogLevel;
    static logFactory: LogFactory;
    static getLogger(loggerName?: string): Logger;
}

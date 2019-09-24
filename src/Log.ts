export enum LogLevel {
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

class _Logger implements Logger {
    constructor(private name: string, private level: LogLevel, private format: boolean, private logger: IConsole = console) { }

    get infoEnabled(): boolean {
        return this.level >= LogLevel.Info;
    }

    get traceEnabled(): boolean {
        return this.level >= LogLevel.Trace;
    }

    get logEnabled(): boolean {
        return this.level >= LogLevel.Log;
    }

    get debugEnabled(): boolean {
        return this.level >= LogLevel.Debug;
    }

    get warnEnabled(): boolean {
        return this.level >= LogLevel.Warn;
    }

    get errorEnabled(): boolean {
        return this.level >= LogLevel.Error;
    }

    get fatalEnabled(): boolean {
        return this.level >= LogLevel.Fatal;
    }

    get logLevel(): LogLevel {
        return this.level;
    }

    set logLevel(val: LogLevel) {
        this.level = val;
    }

    private formatMessage(msg: string, type: string): string {
        return `${(new Date).toLocaleTimeString()} [${type}] [${this.name}] ${msg}`;
    }

    private normalMessage(msg: string): string {
        return `[${this.name}] ${msg}`;
    }

    info(msg: string, ...params: any[]): void {
        msg = this.format ? this.formatMessage(msg, "INFO") : this.normalMessage(msg);
        this.logger.info(msg, params);
    }

    debug(msg: string, ...params: any[]): void {
        msg = this.format ? this.formatMessage(msg, "DEBUG") : this.normalMessage(msg);
        this.logger.debug(msg, params);
    }

    log(msg: string, ...params: any[]): void {
        msg = this.format ? this.formatMessage(msg, "LOG") : this.normalMessage(msg);
        this.logger.debug(msg, params);
    }

    trace(msg: string, ...params: any[]): void {
        msg = this.format ? this.formatMessage(msg, "TRACE") : this.normalMessage(msg);
        this.logger.debug(msg, params);
    }

    warn(msg: string, ...params: any[]): void {
        msg = this.format ? this.formatMessage(msg, "WARN") : this.normalMessage(msg);
        this.logger.warn(msg, params);
    }

    error(msg: string, err: Error): void {
        msg = this.format ? this.formatMessage(msg, "ERROR") : this.normalMessage(msg);
        this.logger.error(msg, err);
    }

    fatal(msg: string, err: Error): void {
        msg = this.format ? this.formatMessage(msg, "FATAL") : this.normalMessage(msg);
        this.logger.error(msg, err);
    }
}


export interface LogFactory {
    createLog: (name: string) => Logger;
    getLevel: () => LogLevel;
    format: boolean;
}

export class LogManager {
    private static consoleLogger: Logger;
    private static defaultLogLevel: LogLevel = LogLevel.All;
    private static factory: LogFactory = {
        createLog: (name: string) => new _Logger(name, LogLevel.All, false),
        format: true,
        getLevel: () => LogManager.defaultLogLevel
    };

    static get defaultLogger(): Logger {
        LogManager.consoleLogger = LogManager.consoleLogger || new _Logger("default", LogManager.defaultLogLevel, true);
        return LogManager.consoleLogger;
    }

    static set defaultLevel(val: LogLevel) {
        LogManager.defaultLogLevel = val;
    }

    static set logFactory(val: LogFactory) {
        LogManager.factory = val;
    }

    static get logFactory(): LogFactory {
        return LogManager.factory;
    }

    static getLogger(loggerName?: string): Logger {
        if (!LogManager.factory) {
            return LogManager.defaultLogger;
        }

        return new _Logger(loggerName || "",
            LogManager.factory.getLevel(),
            LogManager.factory.format,
            LogManager.factory.createLog(loggerName || "")
        );
    }
}
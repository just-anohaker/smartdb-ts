"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["All"] = 127] = "All";
    LogLevel[LogLevel["Trace"] = 64] = "Trace";
    LogLevel[LogLevel["Debug"] = 32] = "Debug";
    LogLevel[LogLevel["Log"] = 16] = "Log";
    LogLevel[LogLevel["Info"] = 8] = "Info";
    LogLevel[LogLevel["Warn"] = 4] = "Warn";
    LogLevel[LogLevel["Error"] = 2] = "Error";
    LogLevel[LogLevel["Fatal"] = 1] = "Fatal";
    LogLevel[LogLevel["None"] = 0] = "None";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class _Logger {
    constructor(name, level, format, logger = console) {
        this.name = name;
        this.level = level;
        this.format = format;
        this.logger = logger;
    }
    get infoEnabled() {
        return this.level >= LogLevel.Info;
    }
    get traceEnabled() {
        return this.level >= LogLevel.Trace;
    }
    get logEnabled() {
        return this.level >= LogLevel.Log;
    }
    get debugEnabled() {
        return this.level >= LogLevel.Debug;
    }
    get warnEnabled() {
        return this.level >= LogLevel.Warn;
    }
    get errorEnabled() {
        return this.level >= LogLevel.Error;
    }
    get fatalEnabled() {
        return this.level >= LogLevel.Fatal;
    }
    get logLevel() {
        return this.level;
    }
    set logLevel(val) {
        this.level = val;
    }
    formatMessage(msg, type) {
        return `${(new Date).toLocaleTimeString()} [${type}] [${this.name}] ${msg}`;
    }
    normalMessage(msg) {
        return `[${this.name}] ${msg}`;
    }
    info(msg, ...params) {
        msg = this.format ? this.formatMessage(msg, "INFO") : this.normalMessage(msg);
        this.logger.info(msg, params);
    }
    debug(msg, ...params) {
        msg = this.format ? this.formatMessage(msg, "DEBUG") : this.normalMessage(msg);
        this.logger.debug(msg, params);
    }
    log(msg, ...params) {
        msg = this.format ? this.formatMessage(msg, "LOG") : this.normalMessage(msg);
        this.logger.debug(msg, params);
    }
    trace(msg, ...params) {
        msg = this.format ? this.formatMessage(msg, "TRACE") : this.normalMessage(msg);
        this.logger.debug(msg, params);
    }
    warn(msg, ...params) {
        msg = this.format ? this.formatMessage(msg, "WARN") : this.normalMessage(msg);
        this.logger.warn(msg, params);
    }
    error(msg, err) {
        msg = this.format ? this.formatMessage(msg, "ERROR") : this.normalMessage(msg);
        this.logger.error(msg, err);
    }
    fatal(msg, err) {
        msg = this.format ? this.formatMessage(msg, "FATAL") : this.normalMessage(msg);
        this.logger.error(msg, err);
    }
}
class LogManager {
    static get defaultLogger() {
        LogManager.consoleLogger = LogManager.consoleLogger || new _Logger("default", LogManager.defaultLogLevel, true);
        return LogManager.consoleLogger;
    }
    static set defaultLevel(val) {
        LogManager.defaultLogLevel = val;
    }
    static set logFactory(val) {
        LogManager.factory = val;
    }
    static get logFactory() {
        return LogManager.factory;
    }
    static getLogger(loggerName) {
        if (!LogManager.factory) {
            return LogManager.defaultLogger;
        }
        return new _Logger(loggerName || "", LogManager.factory.getLevel(), LogManager.factory.format, LogManager.factory.createLog(loggerName || ""));
    }
}
exports.LogManager = LogManager;
LogManager.defaultLogLevel = LogLevel.All;
LogManager.factory = {
    createLog: (name) => new _Logger(name, LogLevel.All, false),
    format: true,
    getLevel: () => LogManager.defaultLogLevel
};

/**
 * Structured Logging Utility
 * 
 * Provides consistent, structured logging for the application.
 * In production, logs are formatted as JSON for easy parsing by log aggregation services.
 * In development, logs are formatted for human readability.
 * 
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   
 *   logger.info("User logged in", { userId: "123", method: "google" });
 *   logger.error("Payment failed", { orderId: "456", error: err.message });
 *   logger.warn("Rate limit approaching", { ip: "1.2.3.4", remaining: 5 });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined | object;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  // Additional metadata that may be added automatically
  requestId?: string;
  userId?: string;
  organizationId?: string;
  environment?: string;
}

/**
 * Get the current log level from environment
 * Defaults to "info" in production, "debug" in development
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel === "debug" || envLevel === "info" || envLevel === "warn" || envLevel === "error") {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = getLogLevel();

/**
 * Check if a log level should be output based on current configuration
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

/**
 * Format a log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    // JSON format for production - easier to parse with log aggregators
    return JSON.stringify(entry);
  }
  
  // Human-readable format for development
  const timestamp = entry.timestamp.split("T")[1].split(".")[0]; // Just HH:MM:SS
  const levelBadge = `[${entry.level.toUpperCase()}]`.padEnd(7);
  const contextStr = entry.context 
    ? ` ${JSON.stringify(entry.context)}`
    : "";
  
  return `${timestamp} ${levelBadge} ${entry.message}${contextStr}`;
}

/**
 * Create a log entry with common fields
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    environment: process.env.NODE_ENV,
  };
}

/**
 * Output a log entry to the appropriate console method
 */
function outputLog(level: LogLevel, entry: LogEntry): void {
  const formatted = formatLogEntry(entry);
  
  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  exception(message: string, error: Error, context?: LogContext): void;
  child(baseContext: LogContext): Logger;
}

/**
 * Main logger object with methods for each log level
 */
export const logger: Logger = {
  /**
   * Debug level - detailed information for debugging
   * Only output in development or when LOG_LEVEL=debug
   */
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      outputLog("debug", createLogEntry("debug", message, context));
    }
  },

  /**
   * Info level - general information about application flow
   */
  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      outputLog("info", createLogEntry("info", message, context));
    }
  },

  /**
   * Warn level - potentially problematic situations
   */
  warn(message: string, context?: LogContext): void {
    if (shouldLog("warn")) {
      outputLog("warn", createLogEntry("warn", message, context));
    }
  },

  /**
   * Error level - errors that need attention
   */
  error(message: string, context?: LogContext): void {
    if (shouldLog("error")) {
      outputLog("error", createLogEntry("error", message, context));
    }
  },

  /**
   * Log an error with stack trace
   */
  exception(message: string, error: Error, context?: LogContext): void {
    if (shouldLog("error")) {
      outputLog("error", createLogEntry("error", message, {
        ...context,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }));
    }
  },

  /**
   * Create a child logger with preset context
   * Useful for adding request-specific context
   */
  child(baseContext: LogContext): typeof logger {
    return {
      debug: (message: string, context?: LogContext) => 
        logger.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) => 
        logger.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) => 
        logger.warn(message, { ...baseContext, ...context }),
      error: (message: string, context?: LogContext) => 
        logger.error(message, { ...baseContext, ...context }),
      exception: (message: string, error: Error, context?: LogContext) => 
        logger.exception(message, error, { ...baseContext, ...context }),
      child: (additionalContext: LogContext) => 
        logger.child({ ...baseContext, ...additionalContext }),
    };
  },
};

/**
 * Create a request-scoped logger with request metadata
 */
export function createRequestLogger(request: Request): typeof logger {
  const requestId = request.headers.get("x-request-id") || 
    Math.random().toString(36).substring(2, 15);
  
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0].trim() || "unknown";
  
  return logger.child({
    requestId,
    ip,
    method: request.method,
    path: new URL(request.url).pathname,
  });
}

export default logger;

/**
 * Structured Logger Utility
 * Provides consistent JSON logging with levels, timestamps, and metadata
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

// Get log level from environment (default: info in production, debug in development)
const DEFAULT_LEVEL = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS[DEFAULT_LEVEL];

class Logger {
  constructor(context = 'app') {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   * @param {string} childContext - Additional context to append
   * @returns {Logger} - New logger instance
   */
  child(childContext) {
    return new Logger(`${this.context}:${childContext}`);
  }

  /**
   * Format and output a log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  _log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) {
      return; // Skip logs below current level
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...(Object.keys(meta).length > 0 && { meta })
    };

    // Add error stack if present
    if (meta.error instanceof Error) {
      entry.meta = {
        ...entry.meta,
        error: {
          name: meta.error.name,
          message: meta.error.message,
          stack: meta.error.stack
        }
      };
    }

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {object|Error} metaOrError - Additional metadata or Error object
   */
  error(message, metaOrError = {}) {
    const meta = metaOrError instanceof Error
      ? { error: metaOrError }
      : metaOrError;
    this._log('error', message, meta);
  }

  /**
   * Log with request context (for HTTP requests)
   * @param {object} req - Express request object
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  request(req, level, message, meta = {}) {
    this._log(level, message, {
      ...meta,
      requestId: req.id,
      method: req.method,
      path: req.path,
      ip: req.ip
    });
  }
}

// Default logger instance
const logger = new Logger();

// Named exports for convenience
export const debug = (msg, meta) => logger.debug(msg, meta);
export const info = (msg, meta) => logger.info(msg, meta);
export const warn = (msg, meta) => logger.warn(msg, meta);
export const error = (msg, meta) => logger.error(msg, meta);

// Create child logger for specific contexts
export const createLogger = (context) => new Logger(context);

// Export default instance
export default logger;

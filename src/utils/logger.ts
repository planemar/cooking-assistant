enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    const level = process.env.LOG_LEVEL?.toUpperCase();

    if (!level) {
      throw new Error('LOG_LEVEL environment variable is required');
    }

    switch (level) {
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      default:
        throw new Error(`Invalid LOG_LEVEL: ${level}. Must be DEBUG, INFO, WARN, or ERROR`);
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message));
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message));
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message));
    }
  }

  error(message: string, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMessage = error ? `${message}: ${error.message}` : message;
      console.error(this.formatMessage('ERROR', errorMessage));

      if (error?.stack) {
        console.error(error.stack);
      }
    }
  }
}

export const logger = Logger.getInstance();

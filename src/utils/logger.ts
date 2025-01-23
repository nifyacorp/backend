type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatMessage({ level, message, data, timestamp }: LogMessage): string {
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    const dataString = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    return `${prefix} ${message}${dataString}`;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level === 'debug' && !this.isDevelopment) {
      return;
    }

    const logMessage = this.formatMessage({
      level,
      message,
      data,
      timestamp: this.getTimestamp(),
    });

    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }
}

export default new Logger();
 export interface ILogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;

}
export class ConsoleLogger implements ILogger {
  info(message: string, meta?: unknown): void {
    console.info(message, meta ?? '');
  }

  error(message: string, meta?: unknown): void {
    console.error(message, meta ?? '');
  }

  warn(message: string, meta?: unknown): void {
    console.warn(message, meta ?? '');
  }

  debug(message: string, meta?: unknown): void {
    console.debug(message, meta ?? '');
  }
}

 
export class TypedLogger {
  constructor(private logger: ILogger) {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  error(message: string, error: Error, context?: Record<string, unknown>): void {
    this.logger.error(message, {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }
}


export class Logger {
    private prefix: string;

    constructor(prefix: string = 'Translate') {
        this.prefix = prefix;
    }

    info(message: string, ...args: unknown[]): void {
        console.log(`[${this.prefix}] ${message}`, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`[${this.prefix}] ${message}`, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(`[${this.prefix}] ${message}`, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        console.debug(`[${this.prefix}] ${message}`, ...args);
    }
}

export const logger = new Logger('AI Translate');

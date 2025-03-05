// Errors about update / signal parsing
export class UpdateParsingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class SignalParsingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

// Base error class for all AV Controls errors
export class AvControlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
export class InvalidMessageError extends AvControlError {
  constructor(message = 'Invalid message format') {
    super(message);
  }
}

export class InvalidPayloadError extends AvControlError {
  constructor(controlType: string, expectedType: string, receivedType: string) {
    super(`Invalid payload for ${controlType}: expected ${expectedType}, received ${receivedType}`);
  }
}

export class ControlNotFoundError extends AvControlError {
  constructor(controlId: string[]) {
    super(`Control not found: ${controlId.join('.')}`);
  }
}

export class CommunicationError extends AvControlError {
  constructor(message = 'Communication error') {
    super(message);
  }
}

    
// Logging utility that can be configured by the application
export class Logger {
  private static logLevel: 'error' | 'warn' | 'info' | 'debug' = 'error';
  private static callback?: (level: string, message: string, data?: any) => void;

  static setLogLevel(level: 'error' | 'warn' | 'info' | 'debug'): void {
    this.logLevel = level;
  }

  static setCallback(callback: (level: string, message: string, data?: any) => void): void {
    this.callback = callback;
  }

  static error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  static warn(message: string, data?: any): void {
    if (['error', 'warn', 'info', 'debug'].includes(this.logLevel)) {
      this.log('warn', message, data);
    }
  }

  static info(message: string, data?: any): void {
    if (['info', 'debug'].includes(this.logLevel)) {
      this.log('info', message, data);
    }
  }

  static debug(message: string, data?: any): void {
    if (this.logLevel === 'debug') {
      this.log('debug', message, data);
    }
  }

  private static log(level: string, message: string, data?: any): void {
    if (this.callback) {
      this.callback(level, message, data);
    } else {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, data !== undefined ? data : '');
      } else if (level === 'warn') {
        console.warn(logMessage, data !== undefined ? data : '');
      } else {
        console.log(logMessage, data !== undefined ? data : '');
      }
    }
  }
}
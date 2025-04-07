/**
 * Error codes used throughout the application
 */
export enum ErrorCode {
  // Generic error codes
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  
  // Domain-specific error codes
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  NOTIFICATION_NOT_FOUND = 'NOTIFICATION_NOT_FOUND',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  
  // Infrastructure error codes
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

/**
 * Standard application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;
  
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Capturing stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Factory method for creating a not found error
   */
  public static notFound(
    message: string,
    code: ErrorCode = ErrorCode.NOT_FOUND,
    details?: unknown
  ): AppError {
    return new AppError(message, code, 404, details, true);
  }
  
  /**
   * Factory method for creating a validation error
   */
  public static validation(
    message: string,
    details?: unknown
  ): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details, true);
  }
  
  /**
   * Factory method for creating an unauthorized error
   */
  public static unauthorized(
    message: string = 'Unauthorized access',
    details?: unknown
  ): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401, details, true);
  }
  
  /**
   * Factory method for creating a forbidden error
   */
  public static forbidden(
    message: string = 'Forbidden access',
    details?: unknown
  ): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403, details, true);
  }
  
  /**
   * Factory method for creating a conflict error
   */
  public static conflict(
    message: string,
    details?: unknown
  ): AppError {
    return new AppError(message, ErrorCode.CONFLICT, 409, details, true);
  }
  
  /**
   * Factory method for creating a database error
   */
  public static database(
    message: string,
    details?: unknown
  ): AppError {
    return new AppError(message, ErrorCode.DATABASE_ERROR, 500, details, true);
  }
}
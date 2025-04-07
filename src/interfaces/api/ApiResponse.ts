/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * API response builder utility
 */
export class ApiResponseBuilder {
  /**
   * Creates a success response
   */
  public static success<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
    return {
      status: 'success',
      data,
      meta
    };
  }

  /**
   * Creates a paginated success response
   */
  public static paginated<T>(
    data: T,
    page: number,
    limit: number,
    total: number
  ): ApiResponse<T> {
    const totalPages = Math.ceil(total / limit);
    
    return {
      status: 'success',
      data,
      meta: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  /**
   * Creates an error response
   */
  public static error<T>(
    code: string,
    message: string,
    details?: unknown
  ): ApiResponse<T> {
    return {
      status: 'error',
      error: {
        code,
        message,
        details
      }
    };
  }
}
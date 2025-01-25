export class AppError extends Error {
  constructor(code, message, status = 500, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}
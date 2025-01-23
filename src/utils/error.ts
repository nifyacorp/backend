export class AppError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const createError = (message: string, status: number): AppError => {
  return new AppError(message, status);
};
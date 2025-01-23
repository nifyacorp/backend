export class AppError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'AppError';
    }
}
export const createError = (message, status) => {
    return new AppError(message, status);
};

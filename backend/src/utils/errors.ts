export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);
export const forbidden = (message: string) => new ApiError(403, "FORBIDDEN", message);
export const unauthorized = (message = "Unauthorized") => new ApiError(401, "UNAUTHORIZED", message);
export const badRequest = (message: string, details?: unknown) => new ApiError(400, "BAD_REQUEST", message, details);
export const conflict = (message: string) => new ApiError(409, "CONFLICT", message);
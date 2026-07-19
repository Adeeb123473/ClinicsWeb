export class ApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message: string, code?: string): ApiError {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = "Unauthorized", code?: string): ApiError {
    return new ApiError(401, message, code);
  }

  static forbidden(message = "Forbidden", code?: string): ApiError {
    return new ApiError(403, message, code);
  }

  static notFound(message = "Not found", code?: string): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code?: string): ApiError {
    return new ApiError(409, message, code);
  }
}

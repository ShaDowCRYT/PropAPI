export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message: string) {
  return new AppError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function unprocessable(message: string, details?: unknown) {
  return new AppError(422, "UNPROCESSABLE_ENTITY", message, details);
}
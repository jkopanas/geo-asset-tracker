export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(id: string) {
    super(404, 'NOT_FOUND', `No asset with id '${id}' exists.`);
  }
}

export class ValidationError extends AppError {
  fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(400, 'VALIDATION_ERROR', message);
    this.fields = fields;
  }
}

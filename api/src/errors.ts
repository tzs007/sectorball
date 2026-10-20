export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ValidationError';
    this.code = code;
  }
}

export class UnauthorizedError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'UnauthorizedError';
    this.code = code;
  }
}

export class NotFoundError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'NotFoundError';
    this.code = code;
  }
}

export class ConflictError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ConflictError';
    this.code = code;
  }
}

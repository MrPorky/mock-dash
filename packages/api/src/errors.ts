/**
 * Represents an HTTP error response (non-2xx status code).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly data: unknown;

  constructor(status: number, statusText: string, data: unknown) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/**
 * Represents a network-level failure (e.g. DNS, connection refused, abort).
 */
export class NetworkError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/**
 * Represents a schema validation failure on a response or input.
 */
export class ValidationError extends Error {
  readonly issues: ReadonlyArray<{
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey>;
  }>;

  constructor(
    message: string,
    issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey> }>,
  ) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

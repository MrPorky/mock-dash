import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { z } from 'zod'

/**
 * Thrown from custom mock handlers to intentionally produce a specific HTTP response.
 * Keep this limited to local mock/dev scenarios – real API failures should surface
 * as ApiError / ValidationError / NetworkError.
 */
export class MockError extends Error {
  /** HTTP status code to return in the mock response */
  readonly status: ContentfulStatusCode

  constructor(message: string, status: ContentfulStatusCode) {
    super(message)
    this.name = 'MockError'
    this.status = status
  }
}

/**
 * Base error representing a completed HTTP response with non-2xx status.
 * Provides response metadata and (parsed or raw) body for higher-level handling.
 */
export class ApiError extends Error {
  public readonly status: number
  public readonly body?: unknown
  public readonly url?: string
  public readonly method?: string

  constructor(
    message: string,
    status: number,
    options?: { body?: unknown; url?: string; method?: string; cause?: Error },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'ApiError'
    this.status = status
    this.body = options?.body
    this.url = options?.url
    this.method = options?.method
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError)
  }
}

/**
 * Raised when Zod validation fails for request input (pre-flight) or response payload.
 * Extends ApiError so callers can branch on either specific validation context
 * or treat it generically as an API failure.
 */
export class ValidationError extends ApiError {
  public readonly validationErrors: z.ZodError
  public readonly validationType: 'request' | 'response'

  constructor(
    message: string,
    validationErrors: z.ZodError,
    validationType: 'request' | 'response',
    options?: {
      status?: number
      body?: unknown
      url?: string
      method?: string
      cause?: Error
    },
  ) {
    super(message, options?.status ?? 400, {
      body: options?.body,
      url: options?.url,
      method: options?.method,
      cause: options?.cause,
    })
    this.name = 'ValidationError'
    this.validationErrors = validationErrors
    this.validationType = validationType
    if (Error.captureStackTrace) Error.captureStackTrace(this, ValidationError)
  }

  /**
   * Return field path => messages[] map. Root issues (no path) use key '_root'.
   */
  public getFieldErrors(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const issue of this.validationErrors.issues) {
      const key = issue.path.join('.') || '_root'
      if (!out[key]) {
        out[key] = []
      }

      out[key].push(issue.message)
    }
    return out
  }

  /**
   * Flatten issues into printable summary strings.
   */
  public getAllErrorMessages(): string[] {
    return this.validationErrors.issues.map(
      (i) => `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}`,
    )
  }
}

/**
 * Indicates the request never produced a valid response due to connectivity,
 * DNS, CORS, abort/timeout or similar network-layer failure.
 */
export class NetworkError extends Error {
  public readonly url?: string
  public readonly method?: string
  public readonly timeout?: boolean
  constructor(
    message: string,
    options?: {
      url?: string
      method?: string
      timeout?: boolean
      cause?: Error
    },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'NetworkError'
    this.url = options?.url
    this.method = options?.method
    this.timeout = options?.timeout ?? false
    if (Error.captureStackTrace) Error.captureStackTrace(this, NetworkError)
  }
}

export type Errors = ApiError | ValidationError | NetworkError

/**
 * Type guard for MockError thrown only from mock generation code paths.
 */
export function isMockError(error: unknown): error is MockError {
  return error instanceof MockError
}
/**
 * Type guard for ApiError representing non-2xx HTTP responses.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
/**
 * Type guard for ValidationError (request or response schema failures).
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}
/**
 * Type guard for NetworkError indicating the request never produced a valid response.
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError
}

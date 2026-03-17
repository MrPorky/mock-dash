import type { StandardSchemaV1 } from '@standard-schema/spec';

export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

export type StandardSchemaLike<T = unknown> = StandardSchemaV1<T, unknown>;

type StandardSchemaRuntime<T> = {
  '~standard'?: {
    validate?: (
      value: unknown,
    ) => StandardValidationOutput<T> | Promise<StandardValidationOutput<T>>;
  };
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: Error };

type StandardValidationSuccess<T> = { value: T; issues?: never };
type StandardValidationFailure = { issues: readonly unknown[]; value?: never };
type StandardValidationOutput<T> =
  | StandardValidationSuccess<T>
  | StandardValidationFailure;

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as { then: unknown }).then === 'function'
  );
}

function getStandardValidator<T>(schema: unknown) {
  const candidate = schema as StandardSchemaRuntime<T>;
  const validate = candidate['~standard']?.validate;
  if (typeof validate === 'function') {
    return validate;
  }

  return undefined;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

function formatValidationError(
  issues: readonly unknown[] | undefined,
  context: string,
): Error {
  if (!issues || issues.length === 0) {
    return new Error(`Validation Error (${context})`);
  }

  return new Error(`Validation Error (${context}): ${JSON.stringify(issues)}`);
}

function normalizeValidationOutput<T>(
  output: StandardValidationOutput<T>,
  context: string,
): ValidationResult<T> {
  if ('issues' in output && output.issues) {
    return { ok: false, error: formatValidationError(output.issues, context) };
  }

  return { ok: true, value: output.value };
}

export async function validateStandard<T>(
  schema: StandardSchemaLike<T>,
  input: unknown,
  context: string,
): Promise<ValidationResult<T>> {
  const validate = getStandardValidator<T>(schema);
  if (!validate) {
    return { ok: true, value: input as T };
  }

  try {
    const raw = validate(input);
    const resolved = isPromiseLike<StandardValidationOutput<T>>(raw)
      ? await raw
      : raw;

    return normalizeValidationOutput(resolved, context);
  } catch (error) {
    return {
      ok: false,
      error: toError(error, `Validation Error (${context})`),
    };
  }
}

export function validateStandardSync<T>(
  schema: StandardSchemaLike<T>,
  input: unknown,
  context: string,
): ValidationResult<T> {
  const validate = getStandardValidator<T>(schema);
  if (!validate) {
    return { ok: true, value: input as T };
  }

  try {
    const raw = validate(input);

    if (isPromiseLike(raw)) {
      return {
        ok: false,
        error: new Error(
          `Validation Error (${context}): asynchronous validation is not supported in this context`,
        ),
      };
    }

    return normalizeValidationOutput(raw, context);
  } catch (error) {
    return {
      ok: false,
      error: toError(error, `Validation Error (${context})`),
    };
  }
}

function normalizeInterpolatedPath(path: string): string {
  return path.replace(/^\/(https?:\/\/)/i, '$1');
}

function pickPathParam(
  key: string,
  params?: Record<string, unknown>,
  alias?: Record<string, string>,
): string {
  if (params && key in params) {
    return encodeURIComponent(String(params[key]));
  }

  if (alias && key in alias) {
    return alias[key] as string;
  }

  return '';
}

export function interpolatePath(
  path: string,
  params?: Record<string, unknown>,
  alias?: Record<string, string>,
): string {
  const withColonParams = path.replace(/:([A-Za-z0-9_]+)/g, (_match, key) =>
    pickPathParam(key, params, alias),
  );

  const withBracedParams = withColonParams.replace(/\{([^}]+)\}/g, (_m, key) =>
    pickPathParam(String(key), params, alias),
  );

  return normalizeInterpolatedPath(withBracedParams);
}

function appendQueryValue(
  target: URLSearchParams,
  key: string,
  value: unknown,
): void {
  if (value === undefined) return;
  if (value === null) {
    target.append(key, 'null');
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(target, key, item);
    }
    return;
  }

  if (typeof value === 'object') {
    target.append(key, JSON.stringify(value));
    return;
  }

  target.append(key, String(value));
}

export function buildQueryString(
  query?: Record<string, unknown>,
): URLSearchParams {
  const out = new URLSearchParams();
  if (!query) return out;

  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(out, key, value);
  }

  return out;
}

export function buildURL(args: {
  baseURL: string;
  path: string;
  params?: Record<string, unknown>;
  alias?: Record<string, string>;
  query?: Record<string, unknown>;
}): URL {
  const interpolatedPath = interpolatePath(args.path, args.params, args.alias);
  const url = /^https?:\/\//i.test(interpolatedPath)
    ? new URL(interpolatedPath)
    : new URL(interpolatedPath, args.baseURL);

  const queryString = buildQueryString(args.query);
  for (const [key, value] of queryString.entries()) {
    url.searchParams.append(key, value);
  }

  return url;
}

export function toWebSocketURL(url: URL): string {
  const wsURL = new URL(url.toString());
  wsURL.protocol = wsURL.protocol === 'https:' ? 'wss:' : 'ws:';
  return wsURL.toString();
}

export function findRouteByMethodAndPath<
  TSchema extends Record<string, { method: HttpMethod; path: string }>,
  TMethod extends HttpMethod,
  TPath extends string,
>(
  apiSchema: TSchema,
  method: TMethod,
  path: TPath,
):
  | Extract<TSchema[keyof TSchema], { method: TMethod; path: TPath }>
  | undefined {
  for (const route of Object.values(apiSchema)) {
    if (route.method === method && route.path === path) {
      return route as Extract<
        TSchema[keyof TSchema],
        { method: TMethod; path: TPath }
      >;
    }
  }

  return undefined;
}

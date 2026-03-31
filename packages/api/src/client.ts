import type { StandardSchemaV1 } from "@standard-schema/spec";

import { ApiError, NetworkError, ValidationError } from "./errors.ts";
import { objectToFormData, validateFormInput } from "./form.ts";
import { createInterceptors } from "./interceptors.ts";
import { readBinaryStream, readJSONStream, readSSEStream } from "./streams.ts";
import type {
  ApiClient,
  ApiSchema,
  BinaryStreamDef,
  ClientConfig,
  EndpointDef,
  HttpMethod,
  InterceptorContext,
  JSONStreamDef,
  RequestOptions,
  ResponseEnvelope,
  SSEDef,
  WebSocketDef,
} from "./types.ts";
import { buildFullUrl } from "./url.ts";
import { connectWebSocket } from "./websocket.ts";

type StreamDefs = BinaryStreamDef | JSONStreamDef | SSEDef | WebSocketDef;

/**
 * Look up an endpoint definition by method and path from the schema.
 */
function findEndpoint(
  schema: ApiSchema,
  method: HttpMethod,
  path: string,
): EndpointDef | undefined {
  for (const def of Object.values(schema)) {
    if (def.method === method && def.path === path) return def;
  }
  return undefined;
}

/**
 * Check if a response definition is a stream/realtime marker.
 */
function isStreamDef(response: unknown): response is StreamDefs {
  return (
    response !== null &&
    typeof response === "object" &&
    "__type" in (response as Record<string, unknown>)
  );
}

function isBinaryStream(r: unknown): r is BinaryStreamDef {
  return isStreamDef(r) && r.__type === "binary-stream";
}

function isJSONStream(r: unknown): r is JSONStreamDef {
  return isStreamDef(r) && r.__type === "json-stream";
}

function isSSE(r: unknown): r is SSEDef {
  return isStreamDef(r) && r.__type === "sse";
}

function isWebSocket(r: unknown): r is WebSocketDef {
  return isStreamDef(r) && r.__type === "websocket";
}

/**
 * Detect if a StandardSchema represents a void response.
 * We check by validating `undefined` — if it passes, it's void-like.
 */
async function isVoidSchema(schema: StandardSchemaV1): Promise<boolean> {
  try {
    const result = await schema["~standard"].validate(undefined);
    // If validation passes for `undefined`, it's a void schema
    return !("issues" in result && result.issues);
  } catch {
    return false;
  }
}

/**
 * Validate data against a StandardSchema. Returns the validated data or throws/returns error.
 */
async function validateSchema(
  schema: StandardSchemaV1,
  data: unknown,
): Promise<{ success: true; data: unknown } | { success: false; error: ValidationError }> {
  const result = await schema["~standard"].validate(data);
  if ("issues" in result && result.issues) {
    return {
      success: false,
      error: new ValidationError(
        "Response validation failed",
        result.issues.map((i) => ({
          message: i.message,
          path: i.path?.map((p) =>
            typeof p === "object" && p !== null && "key" in p ? p.key : p,
          ) as PropertyKey[] | undefined,
        })),
      ),
    };
  }
  return { success: true, data: result.value };
}

/** Internal options shape used by executeRequest (untyped at runtime). */
interface ExecuteOptions {
  param?: Record<string, string>;
  query?: Record<string, string | undefined>;
  json?: unknown;
  form?: FormData | Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  throwOnError?: boolean;
  transformRequest?: (
    context: InterceptorContext,
    options: RequestOptions,
  ) => RequestOptions | Promise<RequestOptions>;
  transformResponse?: (
    context: InterceptorContext,
    response: ResponseEnvelope,
  ) => ResponseEnvelope | Promise<ResponseEnvelope>;
}

/**
 * Create a type-safe API client from an API schema.
 */
export function createApiClient<S extends ApiSchema>(config: ClientConfig<S>): ApiClient<S> {
  const { apiSchema, baseURL, alias } = config;
  const interceptors = createInterceptors();

  // Access fetch lazily so vi.spyOn can intercept after client creation
  function getFetch(): (input: Request) => Response | Promise<Response> {
    return config.fetch ?? globalThis.fetch;
  }

  async function executeRequest(
    method: HttpMethod,
    path: string,
    options: ExecuteOptions = {},
  ): Promise<unknown> {
    const endpoint = findEndpoint(apiSchema, method, path);
    if (!endpoint) {
      throw new Error(`No endpoint defined for ${method} ${path}`);
    }

    const {
      param,
      query,
      json,
      form,
      headers: userHeaders,
      signal,
      throwOnError,
      transformRequest,
      transformResponse,
    } = options;

    const responseDef = endpoint.response;

    // ── WebSocket: completely separate path ───────────────────────
    if (isWebSocket(responseDef)) {
      const url = buildFullUrl(baseURL, path, alias, param, query);
      try {
        const { stream, controller } = connectWebSocket(url, responseDef.serverSchemas, signal);
        return { data: stream, controller };
      } catch (err) {
        if (throwOnError) throw err;
        return { error: err };
      }
    }

    // ── Build URL ────────────────────────────────────────────────
    const url = buildFullUrl(baseURL, path, alias, param, query);

    // ── Input validation & body construction ─────────────────────
    let body: string | FormData | Blob | ArrayBuffer | ReadableStream | null | undefined;
    let contentType: string | undefined;

    if (json !== undefined && endpoint.input?.json) {
      const inputSchema = endpoint.input.json as StandardSchemaV1;
      const validationResult = await validateSchema(inputSchema, json);
      if (!validationResult.success) {
        if (throwOnError) throw validationResult.error;
        return { error: validationResult.error };
      }
      body = JSON.stringify(validationResult.data);
      contentType = "application/json";
    } else if (json !== undefined) {
      body = JSON.stringify(json);
      contentType = "application/json";
    }

    if (form !== undefined && endpoint.input?.form) {
      const fieldSchemas = endpoint.input.form as Record<string, StandardSchemaV1>;

      if (form instanceof FormData) {
        // Validate FormData against schemas
        const result = await validateFormInput(form, fieldSchemas);
        if (!result.valid) {
          if (throwOnError) throw result.error;
          return { error: result.error };
        }
        body = result.formData;
      } else {
        // Plain object: validate then convert
        const result = await validateFormInput(form, fieldSchemas);
        if (!result.valid) {
          if (throwOnError) throw result.error;
          return { error: result.error };
        }
        body = objectToFormData(form);
      }
      // Do not set Content-Type — browser/runtime sets it with boundary for FormData
      contentType = undefined;
    } else if (form !== undefined) {
      body = form instanceof FormData ? form : objectToFormData(form);
    }

    // ── Build request headers ────────────────────────────────────
    const requestHeaders: Record<string, string> = { ...userHeaders };
    if (contentType && body !== undefined) {
      requestHeaders["Content-Type"] = contentType;
    }

    // ── Context for interceptors ─────────────────────────────────
    const context: InterceptorContext = { method, path, endpoint };

    // ── Request options pipeline ─────────────────────────────────
    let requestOptions: RequestOptions = {
      method,
      headers: requestHeaders,
      body,
      signal,
    };

    // Global request interceptors
    requestOptions = await interceptors.request.execute(context, requestOptions);

    // Per-request transformer
    if (transformRequest) {
      requestOptions = await transformRequest(context, requestOptions);
    }

    // ── Execute fetch ────────────────────────────────────────────
    let response: Response;
    try {
      const request = new Request(url, requestOptions);
      response = await getFetch()(request);
    } catch (err) {
      const error = new NetworkError(
        err instanceof Error ? err.message : "Network request failed",
        err,
      );
      if (throwOnError) throw error;
      return { error } satisfies ResponseEnvelope;
    }

    // ── HTTP error handling ──────────────────────────────────────
    if (!response.ok) {
      let errorData: unknown;
      try {
        const ct = response.headers.get("Content-Type") ?? "";
        if (ct.includes("application/json")) {
          errorData = await response.json();
        } else {
          errorData = await response.text();
        }
      } catch {
        errorData = undefined;
      }

      const error = new ApiError(response.status, response.statusText, errorData);
      if (throwOnError) throw error;
      return { error } satisfies ResponseEnvelope;
    }

    // ── Response routing by type ─────────────────────────────────

    // Binary stream
    if (isBinaryStream(responseDef)) {
      const data = readBinaryStream(response.body!);
      let result: ResponseEnvelope = { data };
      if (transformResponse) result = await transformResponse(context, result);
      result = await interceptors.response.execute(context, result);
      return result;
    }

    // JSON (NDJSON) stream
    if (isJSONStream(responseDef)) {
      const data = readJSONStream(response.body!, responseDef.schema);
      let result: ResponseEnvelope = { data };
      if (transformResponse) result = await transformResponse(context, result);
      result = await interceptors.response.execute(context, result);
      return result;
    }

    // SSE stream
    if (isSSE(responseDef)) {
      const data = readSSEStream(response.body!, responseDef.events);
      let result: ResponseEnvelope = { data };
      if (transformResponse) result = await transformResponse(context, result);
      result = await interceptors.response.execute(context, result);
      return result;
    }

    // ── Standard response (JSON, text, void) ─────────────────────
    const schema = responseDef as StandardSchemaV1;

    // Void response
    if (response.status === 204 || (await isVoidSchema(schema))) {
      let result: ResponseEnvelope = { data: undefined };
      if (transformResponse) result = await transformResponse(context, result);
      result = await interceptors.response.execute(context, result);
      if (throwOnError) return result.data;
      return result;
    }

    // Parse response body
    // Always read as text first, then try JSON.parse.
    // This avoids issues where Content-Type doesn't match actual content.
    let rawText: string;
    try {
      rawText = await response.text();
    } catch (err) {
      const error = new ApiError(
        response.status,
        response.statusText || "Parse error",
        `Failed to read response: ${(err as Error).message}`,
      );
      if (throwOnError) throw error;
      return { error } satisfies ResponseEnvelope;
    }

    // Try to parse as JSON first; if it fails, try as raw text
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      // Not valid JSON — use raw text as-is
      parsedData = rawText;
    }

    // Validate against response schema
    const validationResult = await validateSchema(schema, parsedData);
    if (!validationResult.success) {
      // If schema validation fails, this is effectively a broken server response.
      // Wrap as ApiError rather than exposing ValidationError to the caller,
      // UNLESS the JSON parsed fine (meaning the server returned valid JSON
      // but with wrong shape — that's a true validation error).
      const jsonParsedOk = typeof parsedData !== "string" || parsedData !== rawText;
      if (!jsonParsedOk) {
        // Body was not parseable as JSON — server sent garbage
        const error = new ApiError(response.status, response.statusText || "Parse error", rawText);
        if (throwOnError) throw error;
        return { error } satisfies ResponseEnvelope;
      }
      if (throwOnError) throw validationResult.error;
      return { error: validationResult.error } satisfies ResponseEnvelope;
    }

    let result: ResponseEnvelope = { data: validationResult.data };

    // Run response pipeline
    if (transformResponse) result = await transformResponse(context, result);
    result = await interceptors.response.execute(context, result);

    if (throwOnError) return result.data;
    return result;
  }

  return {
    get: (path, ...args) => executeRequest("GET", path, args[0] as ExecuteOptions),
    post: (path, ...args) => executeRequest("POST", path, args[0] as ExecuteOptions),
    put: (path, ...args) => executeRequest("PUT", path, args[0] as ExecuteOptions),
    patch: (path, ...args) => executeRequest("PATCH", path, args[0] as ExecuteOptions),
    delete: (path, ...args) => executeRequest("DELETE", path, args[0] as ExecuteOptions),
    interceptors,
    createEndpointUri(path, params) {
      return buildFullUrl(baseURL, path, alias, params);
    },
  } as ApiClient<S>;
}

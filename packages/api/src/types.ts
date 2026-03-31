import type { StandardSchemaV1 } from "@standard-schema/spec";

// ─── Re-export shared types from @mock-dash/core ───────────────────

export type {
  ApiSchema,
  BinaryStreamDef,
  EndpointDef,
  EndpointInput,
  ExtractParams,
  HasParams,
  HttpMethod,
  InferOutput,
  JSONStreamDef,
  SSEDef,
  SSEEventMap,
  StreamDef,
  WebSocketDef,
} from "@mock-dash/core";

import type {
  BinaryStreamDef,
  EndpointDef,
  ExtractParams,
  HasParams,
  HttpMethod,
  InferOutput,
  JSONStreamDef,
  SSEDef,
  SSEEventMap,
  StreamDef,
  WebSocketDef,
  ApiSchema,
} from "@mock-dash/core";

// ─── Stream Chunk Types ────────────────────────────────────────────

export interface BinaryChunk {
  readonly type: "binary";
  readonly data: Uint8Array;
}

export interface JSONChunk<T = unknown> {
  readonly type: "json";
  readonly data: T;
}

export interface ErrorChunk {
  readonly type: "error";
  readonly error: Error;
}

export interface SSEEventChunk<N extends string = string, T = unknown> {
  readonly type: "event";
  readonly name: N;
  readonly data: T;
}

export interface WSStatusChunk {
  readonly type: "status";
  readonly status: "connecting" | "open" | "closed";
}

export interface WSMessageChunk<T = unknown> {
  readonly type: "message";
  readonly data: T;
}

export interface WSBinaryChunk {
  readonly type: "binary";
  readonly data: ArrayBuffer | Blob | SharedArrayBuffer;
}

// ─── Response Type Inference ───────────────────────────────────────

export type BinaryStreamResult = AsyncIterable<BinaryChunk>;

export type JSONStreamResult<S extends StandardSchemaV1> = AsyncIterable<
  JSONChunk<InferOutput<S>> | ErrorChunk
>;

export type SSEStreamResult<E extends SSEEventMap> = AsyncIterable<
  { [K in keyof E & string]: SSEEventChunk<K, InferOutput<E[K]>> }[keyof E & string] | ErrorChunk
>;

export type WSStreamResult<Server extends StandardSchemaV1[]> = AsyncIterable<
  WSStatusChunk | WSMessageChunk<InferOutput<Server[number]>> | WSBinaryChunk | ErrorChunk
>;

// ─── Infer the final data type from a response definition ──────────

export type InferResponseData<R> = R extends BinaryStreamDef
  ? BinaryStreamResult
  : R extends JSONStreamDef<infer S>
    ? JSONStreamResult<S>
    : R extends SSEDef<infer E>
      ? SSEStreamResult<E>
      : R extends WebSocketDef<infer Server, any>
        ? WSStreamResult<Server>
        : R extends StandardSchemaV1
          ? InferOutput<R>
          : never;

// ─── WebSocket Controller ──────────────────────────────────────────

export interface WebSocketController {
  send(data: unknown): void;
  sendRaw(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

// ─── Interceptors ──────────────────────────────────────────────────

export interface InterceptorContext {
  readonly method: HttpMethod;
  readonly path: string;
  readonly endpoint: EndpointDef;
}

export interface RequestOptions {
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string | FormData | Blob | ArrayBuffer | ReadableStream | null;
  signal?: AbortSignal;
}

export interface ResponseEnvelope<T = unknown> {
  data?: T;
  error?: Error;
  controller?: WebSocketController;
}

export type RequestInterceptorFn = (
  context: InterceptorContext,
  options: RequestOptions,
) => RequestOptions | Promise<RequestOptions>;

export type ResponseInterceptorFn = (
  context: InterceptorContext,
  response: ResponseEnvelope,
) => ResponseEnvelope | Promise<ResponseEnvelope>;

export interface InterceptorRegistry<F> {
  use(fn: F): void;
}

export interface Interceptors {
  request: InterceptorRegistry<RequestInterceptorFn>;
  response: InterceptorRegistry<ResponseInterceptorFn>;
}

// ─── Find endpoint by method + path ────────────────────────────────

export type FindEndpointResponse<S extends ApiSchema, M extends HttpMethod, P extends string> = {
  [K in keyof S]: S[K] extends EndpointDef<M, infer EP, any, infer R>
    ? EP extends P
      ? R
      : never
    : never;
}[keyof S];

// ─── Paths by method ──────────────────────────────────────────────

export type PathsForMethod<S extends ApiSchema, M extends HttpMethod> = {
  [K in keyof S]: S[K] extends EndpointDef<M, infer P, any, any> ? P : never;
}[keyof S];

// ─── Find full endpoint def ────────────────────────────────────────

export type FindEndpoint<S extends ApiSchema, M extends HttpMethod, P extends string> = {
  [K in keyof S]: S[K] extends EndpointDef<M, P, any, any> ? S[K] : never;
}[keyof S];

// ─── Options inference ─────────────────────────────────────────────

type CommonOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  transformRequest?: RequestInterceptorFn;
  transformResponse?: ResponseInterceptorFn;
};

/** Map form field schemas to their output types */
type InferFormFields<F> = {
  [K in keyof F]: F[K] extends StandardSchemaV1<any, infer O> ? O : string;
};

/** Determine which form fields are required by checking if their schema input accepts undefined */
type FormRequiredKeys<F> = {
  [K in keyof F]-?: F[K] extends StandardSchemaV1<infer I, unknown>
    ? undefined extends I
      ? never
      : K
    : K;
}[keyof F];

/** Determine which query fields are required by checking if their schema input accepts undefined */
type QueryRequiredKeys<Q> = {
  [K in keyof Q]-?: Q[K] extends StandardSchemaV1<infer I, unknown>
    ? undefined extends I
      ? never
      : K
    : K;
}[keyof Q];

/** Map query field schemas to their output types */
type InferQueryFields<Q> = {
  [K in keyof Q]: Q[K] extends StandardSchemaV1<any, infer O> ? O : string;
};

/** Build the options type for a given endpoint */
export type InferOptions<E extends EndpointDef, P extends string> = CommonOptions &
  (HasParams<P> extends true ? { param: ExtractParams<P> } : { param?: never }) &
  (E["input"] extends { query: Record<string, StandardSchemaV1> }
    ? E["input"] extends { query: infer Q }
      ? {
          query: Partial<InferQueryFields<Q>> &
            Required<Pick<InferQueryFields<Q>, QueryRequiredKeys<Q>>>;
        }
      : { query?: never }
    : { query?: never }) &
  (E["input"] extends { json: StandardSchemaV1 }
    ? E["input"] extends { json: infer J }
      ? {
          json: J extends StandardSchemaV1<any, infer O>
            ? O extends undefined
              ? never
              : Partial<O> & Required<Pick<O, RequiredKeys<O>>>
            : never;
        }
      : { json?: never }
    : { json?: never }) &
  (E["input"] extends { form: Record<string, StandardSchemaV1> }
    ? E["input"] extends { form: infer F }
      ? {
          form:
            | FormData
            | (Partial<InferFormFields<F>> &
                Required<Pick<InferFormFields<F>, FormRequiredKeys<F>>>);
        }
      : { form?: never }
    : { form?: never });

type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

// ─── Result inference ──────────────────────────────────────────────

export type SafeResult<R> =
  R extends WebSocketDef<infer Server, any>
    ? { data?: WSStreamResult<Server>; error?: Error; controller: WebSocketController }
    : { data?: InferResponseData<R>; error?: Error };

export type ThrowResult<R> =
  R extends WebSocketDef<infer Server, any>
    ? { data?: WSStreamResult<Server>; error?: Error; controller: WebSocketController }
    : R extends StreamDef
      ? { data?: InferResponseData<R>; error?: Error }
      : InferResponseData<R>;

// ─── Client method signatures ──────────────────────────────────────

export type ClientConfig<S extends ApiSchema = ApiSchema> = {
  apiSchema: S;
  baseURL: string;
  fetch?: (request: Request) => Response | Promise<Response>;
  alias?: Record<string, string>;
};

export type ApiClient<S extends ApiSchema> = {
  get: ClientMethodForVerb<S, "GET">;
  post: ClientMethodForVerb<S, "POST">;
  put: ClientMethodForVerb<S, "PUT">;
  patch: ClientMethodForVerb<S, "PATCH">;
  delete: ClientMethodForVerb<S, "DELETE">;
  interceptors: Interceptors;
  createEndpointUri: <P extends PathsForMethod<S, HttpMethod>>(
    path: P,
    params?: Record<string, string>,
  ) => string;
};

type ClientMethodForVerb<S extends ApiSchema, M extends HttpMethod> = <
  P extends PathsForMethod<S, M>,
  Throw extends boolean = false,
>(
  path: P,
  ...args: MethodArgs<FindEndpoint<S, M, P>, P, Throw>
) => Promise<
  Throw extends true
    ? ThrowResult<FindEndpoint<S, M, P>["response"]>
    : SafeResult<FindEndpoint<S, M, P>["response"]>
>;

type MethodArgs<E extends EndpointDef, P extends string, Throw extends boolean> =
  IsEmptyOptions<E, P> extends true
    ? [options?: InferOptions<E, P> & { throwOnError?: Throw }]
    : [options: InferOptions<E, P> & { throwOnError?: Throw }];

type IsEmptyOptions<E extends EndpointDef, P extends string> =
  HasParams<P> extends true
    ? false
    : E["input"] extends undefined
      ? true
      : E["input"] extends { json: StandardSchemaV1 }
        ? false
        : E["input"] extends { form: Record<string, StandardSchemaV1> }
          ? false
          : E["input"] extends { query: Record<string, StandardSchemaV1> }
            ? false
            : true;

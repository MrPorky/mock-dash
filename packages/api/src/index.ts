import type { StandardSchemaV1 } from '@standard-schema/spec';
import {
  buildURL,
  findRouteByMethodAndPath,
  type HttpMethod,
  type StandardSchemaLike,
  toWebSocketURL,
  validateStandard,
  validateStandardSync,
} from './core/router.js';

export type SchemaShape = Record<string, StandardSchemaLike>;

type InferSchemaOutput<TSchema> =
  TSchema extends StandardSchemaV1<infer TOut, unknown> ? TOut : unknown;

type InferSchemaInput<TSchema> =
  TSchema extends StandardSchemaV1<unknown, infer TIn> ? TIn : unknown;

type EmptyObject = Record<never, never>;

type Simplify<T> = { [K in keyof T]: T[K] } & EmptyObject;

type MaybePromise<T> = T | PromiseLike<T>;

export type FetchLike = (request: Request) => MaybePromise<Response>;

export type BinaryStreamResponse = {
  _tag: 'binary-stream';
  mimeType: string;
};

export type JsonStreamResponse<TSchema extends StandardSchemaLike> = {
  _tag: 'json-stream';
  schema: TSchema;
};

export type SSEStreamResponse<TEvents extends SchemaShape> = {
  _tag: 'sse-stream';
  events: TEvents;
};

export type WebSocketStreamResponse<
  TIncoming extends readonly StandardSchemaLike[],
  TOutgoing extends readonly StandardSchemaLike[],
> = {
  _tag: 'websocket-stream';
  incoming: TIncoming;
  outgoing: TOutgoing;
};

export type RouteInput = {
  query?: SchemaShape;
  params?: SchemaShape;
  headers?: SchemaShape;
  json?: StandardSchemaLike;
};

type ConsumePathParamName<TParam extends string> =
  TParam extends `${infer Name}/${string}` ? Name : TParam;

type PathParamNames<TPath extends string> =
  TPath extends `${string}:${infer Param}`
    ? ConsumePathParamName<Param> | PathParamNames<`/${Param}`>
    : never;

type ExtractPathParams<TPath extends string> = [PathParamNames<TPath>] extends [
  never,
]
  ? EmptyObject
  : { [K in PathParamNames<TPath>]: string | number };

type SchemaInputObject<TShape extends SchemaShape | undefined> =
  TShape extends SchemaShape
    ? { [K in keyof TShape]?: InferSchemaInput<TShape[K]> }
    : EmptyObject;

type ParamsInputFor<
  TPath extends string,
  TInput extends RouteInput | undefined,
> = Simplify<
  Omit<
    SchemaInputObject<TInput extends RouteInput ? TInput['params'] : undefined>,
    keyof ExtractPathParams<TPath>
  > & {
    [K in keyof ExtractPathParams<TPath>]: K extends keyof SchemaInputObject<
      TInput extends RouteInput ? TInput['params'] : undefined
    >
      ? Exclude<
          SchemaInputObject<
            TInput extends RouteInput ? TInput['params'] : undefined
          >[K],
          undefined
        >
      : ExtractPathParams<TPath>[K];
  }
>;

type RouteInputOptions<
  TPath extends string,
  TInput extends RouteInput | undefined,
> = (TInput extends RouteInput
  ? {
      query?: TInput['query'] extends SchemaShape
        ? {
            [K in keyof TInput['query']]?: InferSchemaInput<TInput['query'][K]>;
          }
        : never;
      params?: keyof ParamsInputFor<TPath, TInput> extends never
        ? never
        : ParamsInputFor<TPath, TInput>;
      headers?: TInput['headers'] extends SchemaShape
        ? {
            [K in keyof TInput['headers']]?: InferSchemaInput<
              TInput['headers'][K]
            >;
          }
        : never;
      json?: TInput['json'] extends StandardSchemaLike
        ? InferSchemaInput<TInput['json']>
        : never;
    }
  : EmptyObject) & {
  params?: keyof ParamsInputFor<TPath, TInput> extends never
    ? never
    : ParamsInputFor<TPath, TInput>;
  signal?: AbortSignal;
};

type CallOptionsTuple<
  TPath extends string,
  TInput extends RouteInput | undefined,
> = keyof ParamsInputFor<TPath, TInput> extends never
  ? [options?: RouteInputOptions<TPath, TInput>]
  : [
      options: RouteInputOptions<TPath, TInput> & {
        params: ParamsInputFor<TPath, TInput>;
      },
    ];

export type RouteDefinition<
  TMethod extends HttpMethod,
  TPath extends string,
  TInput extends RouteInput | undefined,
  TResponse,
> = {
  method: TMethod;
  path: TPath;
  input?: TInput;
  response: TResponse;
};

export function defineGet<
  const TPath extends string,
  const TInput extends RouteInput | undefined,
  const TResponse,
>(
  path: TPath,
  definition: {
    input?: TInput;
    response: TResponse;
  },
): RouteDefinition<'get', TPath, TInput, TResponse> {
  return { method: 'get', path, ...definition };
}

export function definePost<
  const TPath extends string,
  const TInput extends RouteInput | undefined,
  const TResponse,
>(
  path: TPath,
  definition: {
    input?: TInput;
    response: TResponse;
  },
): RouteDefinition<'post', TPath, TInput, TResponse> {
  return { method: 'post', path, ...definition };
}

export function definePut<
  const TPath extends string,
  const TInput extends RouteInput | undefined,
  const TResponse,
>(
  path: TPath,
  definition: {
    input?: TInput;
    response: TResponse;
  },
): RouteDefinition<'put', TPath, TInput, TResponse> {
  return { method: 'put', path, ...definition };
}

export function defineDelete<
  const TPath extends string,
  const TInput extends RouteInput | undefined,
  const TResponse,
>(
  path: TPath,
  definition: {
    input?: TInput;
    response: TResponse;
  },
): RouteDefinition<'delete', TPath, TInput, TResponse> {
  return { method: 'delete', path, ...definition };
}

export function defineBinaryStream(mimeType: string): BinaryStreamResponse {
  return { _tag: 'binary-stream', mimeType };
}

export function defineJSONStream<const TSchema extends StandardSchemaLike>(
  schema: TSchema,
): JsonStreamResponse<TSchema> {
  return { _tag: 'json-stream', schema };
}

export function defineSSEStream<const TEvents extends SchemaShape>(
  events: TEvents,
): SSEStreamResponse<TEvents> {
  return { _tag: 'sse-stream', events };
}

export function defineWebSocketStream<
  const TIncoming extends readonly StandardSchemaLike[],
  const TOutgoing extends readonly StandardSchemaLike[],
>(
  incoming: TIncoming,
  outgoing: TOutgoing,
): WebSocketStreamResponse<TIncoming, TOutgoing> {
  return { _tag: 'websocket-stream', incoming, outgoing };
}

type ApiSchema = Record<
  string,
  RouteDefinition<HttpMethod, string, RouteInput | undefined, unknown>
>;

type RoutesByMethod<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
> = Extract<TSchema[keyof TSchema], { method: TMethod }>;

type PathsByMethod<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
> = RoutesByMethod<TSchema, TMethod>['path'];

type RouteByMethodAndPath<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
  TPath extends string,
> = Extract<RoutesByMethod<TSchema, TMethod>, { path: TPath }>;

type InputFor<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
  TPath extends string,
> =
  RouteByMethodAndPath<TSchema, TMethod, TPath> extends {
    input?: infer TInput;
  }
    ? TInput extends RouteInput | undefined
      ? TInput
      : undefined
    : undefined;

type ResponseFor<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
  TPath extends string,
> =
  RouteByMethodAndPath<TSchema, TMethod, TPath> extends {
    response: infer TResponse;
  }
    ? TResponse
    : never;

type BinaryChunk = { type: 'binary'; data: Uint8Array };
type JsonChunk<TData> =
  | { type: 'json'; data: TData }
  | { type: 'error'; error: Error };
type SSEChunk<TData, TName extends string> = {
  type: 'event';
  name: TName;
  data: TData;
};
type WSStatusChunk = {
  type: 'status';
  status: 'connecting' | 'open' | 'closed';
};
type WSMessageChunk<TData> = { type: 'message'; data: TData };
type WSErrorChunk = { type: 'error'; error: Error };

type OutgoingWSMessage<TOutgoing extends readonly StandardSchemaLike[]> =
  InferSchemaInput<TOutgoing[number]>;

type IncomingWSMessage<TIncoming extends readonly StandardSchemaLike[]> =
  InferSchemaOutput<TIncoming[number]>;

type InferResponseData<TResponse> = TResponse extends BinaryStreamResponse
  ? AsyncIterable<BinaryChunk>
  : TResponse extends JsonStreamResponse<infer TSchema>
    ? AsyncIterable<JsonChunk<InferSchemaOutput<TSchema>>>
    : TResponse extends SSEStreamResponse<infer TEvents>
      ? AsyncIterable<
          SSEChunk<
            InferSchemaOutput<TEvents[keyof TEvents]>,
            Extract<keyof TEvents, string>
          >
        >
      : TResponse extends WebSocketStreamResponse<
            infer TIn,
            readonly StandardSchemaLike[]
          >
        ? AsyncIterable<
            | WSStatusChunk
            | WSMessageChunk<IncomingWSMessage<TIn>>
            | WSErrorChunk
          >
        : TResponse extends StandardSchemaLike
          ? InferSchemaOutput<TResponse>
          : never;

type InferController<TResponse> =
  TResponse extends WebSocketStreamResponse<
    readonly StandardSchemaLike[],
    infer TOut
  >
    ? {
        send: (message: OutgoingWSMessage<TOut>) => void;
        close: (code?: number, reason?: string) => void;
      }
    : never;

type ClientSuccessResult<TResponse> =
  InferController<TResponse> extends never
    ? { data: InferResponseData<TResponse>; error?: undefined }
    : {
        data: InferResponseData<TResponse>;
        controller: InferController<TResponse>;
        error?: undefined;
      };

type ClientErrorResult = {
  data?: undefined;
  controller?: undefined;
  error: Error;
};

type ClientResult<TResponse> =
  | ClientSuccessResult<TResponse>
  | ClientErrorResult;

function isClientErrorResult(value: unknown): value is ClientErrorResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    (value as { error?: unknown }).error instanceof Error
  );
}

type InferSSEEventOutput<TResponse, TEventName extends string> =
  TResponse extends SSEStreamResponse<infer TEvents>
    ? TEventName extends keyof TEvents
      ? InferSchemaOutput<TEvents[TEventName]>
      : never
    : never;

export type InferOutput<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
  TPath extends PathsByMethod<TSchema, TMethod>,
  TEventName extends string | undefined = undefined,
> = TEventName extends string
  ? InferSSEEventOutput<ResponseFor<TSchema, TMethod, TPath>, TEventName>
  : InferResponseData<ResponseFor<TSchema, TMethod, TPath>>;

type AsyncQueueController<T> = {
  push: (value: T) => void;
  close: () => void;
  iterable: AsyncIterable<T>;
};

function createAsyncQueue<T>(): AsyncQueueController<T> {
  const buffered: T[] = [];
  const waiters: Array<(result: IteratorResult<T>) => void> = [];
  let isClosed = false;

  return {
    push(value) {
      if (isClosed) return;
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value, done: false });
        return;
      }

      buffered.push(value);
    },
    close() {
      if (isClosed) return;
      isClosed = true;

      while (waiters.length > 0) {
        const waiter = waiters.shift();
        waiter?.({ value: undefined, done: true });
      }
    },
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next() {
            if (buffered.length > 0) {
              const value = buffered.shift() as T;
              return Promise.resolve({ value, done: false });
            }

            if (isClosed) {
              return Promise.resolve({ value: undefined, done: true });
            }

            return new Promise<IteratorResult<T>>((resolve) => {
              waiters.push(resolve);
            });
          },
        };
      },
    },
  };
}

function isStreamResponse(
  response: unknown,
): response is
  | BinaryStreamResponse
  | JsonStreamResponse<StandardSchemaLike>
  | SSEStreamResponse<SchemaShape>
  | WebSocketStreamResponse<
      readonly StandardSchemaLike[],
      readonly StandardSchemaLike[]
    > {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('_tag' in response)
  ) {
    return false;
  }

  const tag = (response as { _tag: unknown })._tag;
  return (
    tag === 'binary-stream' ||
    tag === 'json-stream' ||
    tag === 'sse-stream' ||
    tag === 'websocket-stream'
  );
}

async function validateObjectShape(
  shape: SchemaShape | undefined,
  source: Record<string, unknown> | undefined,
  context: string,
): Promise<
  { ok: true; value: Record<string, unknown> } | { ok: false; error: Error }
> {
  if (!shape) {
    return { ok: true, value: source ?? {} };
  }

  const out: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(shape)) {
    const currentValue = source?.[key];
    const validated = await validateStandard(
      schema,
      currentValue,
      `${context}.${key}`,
    );
    if (!validated.ok) {
      return validated;
    }

    if (validated.value !== undefined) {
      out[key] = validated.value;
    }
  }

  return { ok: true, value: out };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return undefined;
  return JSON.parse(text);
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

type RouteOptionBag = {
  signal?: AbortSignal;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  json?: unknown;
};

type ValidatedRouteOptions = {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  headers: Record<string, unknown>;
  jsonBody: unknown;
};

function getOptionBag(options: unknown): RouteOptionBag {
  return (options ?? {}) as RouteOptionBag;
}

async function validateQueryAndParams(
  input: RouteInput | undefined,
  optionBag: RouteOptionBag,
): Promise<
  | { query: Record<string, unknown>; params: Record<string, unknown> }
  | ClientErrorResult
> {
  const validatedQuery = await validateObjectShape(
    input?.query,
    optionBag.query,
    'query',
  );
  if (!validatedQuery.ok) return { error: validatedQuery.error };

  const validatedParams = await validateObjectShape(
    input?.params,
    optionBag.params,
    'params',
  );
  if (!validatedParams.ok) return { error: validatedParams.error };

  return {
    query: validatedQuery.value,
    params: validatedParams.value,
  };
}

async function validateHeaders(
  input: RouteInput | undefined,
  optionBag: RouteOptionBag,
): Promise<Record<string, unknown> | ClientErrorResult> {
  const validatedHeaders = await validateObjectShape(
    input?.headers,
    optionBag.headers,
    'headers',
  );
  if (!validatedHeaders.ok) return { error: validatedHeaders.error };

  return validatedHeaders.value;
}

async function validateJsonBody(
  input: RouteInput | undefined,
  optionBag: RouteOptionBag,
): Promise<unknown | ClientErrorResult> {
  if (input?.json) {
    const validatedJson = await validateStandard(
      input.json,
      optionBag.json,
      'json',
    );

    if (!validatedJson.ok) return { error: validatedJson.error };
    return validatedJson.value;
  }

  if (optionBag.json !== undefined) {
    return optionBag.json;
  }

  return undefined;
}

async function validateRouteOptions(
  input: RouteInput | undefined,
  optionBag: RouteOptionBag,
): Promise<ValidatedRouteOptions | ClientErrorResult> {
  const validatedQueryAndParams = await validateQueryAndParams(
    input,
    optionBag,
  );
  if (isClientErrorResult(validatedQueryAndParams)) {
    return validatedQueryAndParams;
  }

  const validatedHeaders = await validateHeaders(input, optionBag);
  if (isClientErrorResult(validatedHeaders)) {
    return validatedHeaders;
  }

  const validatedJsonBody = await validateJsonBody(input, optionBag);
  if (isClientErrorResult(validatedJsonBody)) {
    return validatedJsonBody;
  }

  return {
    query: validatedQueryAndParams.query,
    params: validatedQueryAndParams.params,
    headers: validatedHeaders,
    jsonBody: validatedJsonBody,
  };
}

function createRequestHeaders(
  validatedHeaders: Record<string, unknown>,
  jsonBody: unknown,
): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(validatedHeaders)) {
    headers.set(key, String(value));
  }

  if (jsonBody !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return headers;
}

function createRouteRequest(args: {
  route: RouteDefinition<HttpMethod, string, RouteInput | undefined, unknown>;
  baseURL: string;
  alias?: Record<string, string>;
  validatedOptions: ValidatedRouteOptions;
  signal?: AbortSignal;
}): Request {
  const url = buildURL({
    baseURL: args.baseURL,
    path: args.route.path,
    params: args.validatedOptions.params,
    alias: args.alias,
    query: args.validatedOptions.query,
  });

  const headers = createRequestHeaders(
    args.validatedOptions.headers,
    args.validatedOptions.jsonBody,
  );

  return new Request(url.toString(), {
    method: args.route.method.toUpperCase(),
    headers,
    body:
      args.validatedOptions.jsonBody === undefined
        ? undefined
        : JSON.stringify(args.validatedOptions.jsonBody),
    signal: args.signal,
  });
}

async function executeFetchRequest(args: {
  fetcher: FetchLike;
  request: Request;
  signal?: AbortSignal;
}): Promise<Response> {
  const { signal } = args;
  if (!signal) {
    return Promise.resolve(args.fetcher(args.request));
  }

  if (signal.aborted) {
    throw new Error('The operation was aborted');
  }

  return new Promise<Response>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new Error('The operation was aborted'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    Promise.resolve(args.fetcher(args.request))
      .then((result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      })
      .catch((error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
  });
}

function toHttpError(response: Response): ClientErrorResult | undefined {
  if (response.ok) return undefined;

  return {
    error: new Error(`${response.status} ${response.statusText}`.trim()),
  };
}

function toStreamResult<TResponse>(
  response: Response,
  streamResponse:
    | BinaryStreamResponse
    | JsonStreamResponse<StandardSchemaLike>
    | SSEStreamResponse<SchemaShape>
    | WebSocketStreamResponse<
        readonly StandardSchemaLike[],
        readonly StandardSchemaLike[]
      >,
): ClientResult<TResponse> {
  switch (streamResponse._tag) {
    case 'binary-stream':
      return {
        data: readBinaryStream(response) as InferResponseData<TResponse>,
      } as ClientResult<TResponse>;
    case 'json-stream':
      return {
        data: readJsonStream(
          response,
          streamResponse.schema,
        ) as InferResponseData<TResponse>,
      } as ClientResult<TResponse>;
    case 'sse-stream':
      return {
        data: readSSEStream(
          response,
          streamResponse.events,
        ) as InferResponseData<TResponse>,
      } as ClientResult<TResponse>;
    case 'websocket-stream':
      return {
        error: new Error('WebSocket stream should be handled before fetch'),
      };
  }
}

async function parseOptionalJsonResponse(response: Response): Promise<unknown> {
  return response.status === 204 ? undefined : parseJsonResponse(response);
}

function isStandardSchemaResponse(
  responseSchema: unknown,
): responseSchema is StandardSchemaLike {
  return (
    (typeof responseSchema === 'object' ||
      typeof responseSchema === 'function') &&
    responseSchema !== null &&
    '~standard' in (responseSchema as Record<string, unknown>)
  );
}

async function toSchemaResult<TResponse>(
  response: Response,
  responseSchema: TResponse,
): Promise<ClientResult<TResponse>> {
  if (responseSchema === undefined) {
    try {
      return {
        data: (await parseOptionalJsonResponse(
          response,
        )) as InferResponseData<TResponse>,
      } as ClientResult<TResponse>;
    } catch {
      return {
        data: undefined as InferResponseData<TResponse>,
      } as ClientResult<TResponse>;
    }
  }

  if (!isStandardSchemaResponse(responseSchema)) {
    return {
      error: new Error('Response schema is missing'),
    };
  }

  let payload: unknown;
  try {
    payload = await parseOptionalJsonResponse(response);
  } catch (error) {
    return {
      error: toError(error, 'Failed to parse response body'),
    };
  }

  const validatedResponse = await validateStandard(
    responseSchema,
    payload,
    'response',
  );
  if (!validatedResponse.ok) {
    return { error: validatedResponse.error };
  }

  return {
    data: validatedResponse.value as InferResponseData<TResponse>,
  } as ClientResult<TResponse>;
}

async function toWebSocketResult<TResponse>(args: {
  response: TResponse;
  baseURL: string;
  path: string;
  alias?: Record<string, string>;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
}): Promise<ClientResult<TResponse> | undefined> {
  if (
    !isStreamResponse(args.response) ||
    args.response._tag !== 'websocket-stream'
  ) {
    return undefined;
  }

  const wsClient = await createWebSocketClient({
    baseURL: args.baseURL,
    path: args.path,
    params: args.params,
    query: args.query,
    alias: args.alias,
    incoming: args.response.incoming,
    outgoing: args.response.outgoing,
  });

  if ('error' in wsClient) {
    return { error: wsClient.error };
  }

  return {
    data: wsClient.data as InferResponseData<TResponse>,
    controller: wsClient.controller as InferController<TResponse>,
  } as ClientResult<TResponse>;
}

async function executeHttpRoute<
  TInput extends RouteInput | undefined,
  TResponse,
>(args: {
  route: RouteDefinition<HttpMethod, string, TInput, TResponse>;
  baseURL: string;
  alias?: Record<string, string>;
  fetcher: FetchLike;
  options?: RouteInputOptions<string, TInput>;
}): Promise<ClientResult<TResponse>> {
  const options = args.options;
  const optionBag = getOptionBag(options);
  const input = args.route.input;

  const validatedOptions = await validateRouteOptions(input, optionBag);
  if ('error' in validatedOptions) {
    return validatedOptions;
  }

  const websocketResult = await toWebSocketResult({
    response: args.route.response,
    baseURL: args.baseURL,
    path: args.route.path,
    alias: args.alias,
    query: validatedOptions.query,
    params: validatedOptions.params,
  });
  if (websocketResult) {
    return websocketResult;
  }

  const request = createRouteRequest({
    route: args.route as RouteDefinition<
      HttpMethod,
      string,
      RouteInput | undefined,
      unknown
    >,
    baseURL: args.baseURL,
    alias: args.alias,
    validatedOptions,
    signal: options?.signal,
  });

  let response: Response;
  try {
    response = await executeFetchRequest({
      fetcher: args.fetcher,
      request,
      signal: optionBag.signal,
    });
  } catch (error) {
    return {
      error: toError(error, 'Request failed'),
    };
  }

  const httpError = toHttpError(response);
  if (httpError) {
    return httpError;
  }

  if (isStreamResponse(args.route.response)) {
    return toStreamResult(response, args.route.response);
  }

  return toSchemaResult(response, args.route.response);
}

async function* readBinaryStream(
  response: Response,
): AsyncIterable<BinaryChunk> {
  if (!response.body) return;

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      yield { type: 'binary', data: value };
    }
  } finally {
    reader.releaseLock();
  }
}

async function* readJsonStream<TData>(
  response: Response,
  schema: StandardSchemaLike<TData>,
): AsyncIterable<JsonChunk<TData>> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeLine = (line: string): JsonChunk<TData> | undefined => {
    const trimmed = line.trim();
    if (!trimmed) return undefined;

    try {
      const parsed = JSON.parse(trimmed);
      const validated = validateStandardSync(schema, parsed, 'json-stream');
      if (!validated.ok) {
        return { type: 'error', error: validated.error };
      }

      return { type: 'json', data: validated.value };
    } catch (error) {
      return {
        type: 'error',
        error: toError(error, 'JSON stream parse error'),
      };
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const out = consumeLine(line);
        if (out) {
          yield out;
        }
      }

      if (done) break;
    }

    if (buffer) {
      const out = consumeLine(buffer);
      if (out) {
        yield out;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

type SSEEventBuffer = {
  event?: string;
  dataLines: string[];
};

type SSEOutputChunk<TEvents extends SchemaShape> = SSEChunk<
  InferSchemaOutput<TEvents[keyof TEvents]>,
  Extract<keyof TEvents, string>
>;

function flushSSEEvent<TEvents extends SchemaShape>(args: {
  current: SSEEventBuffer;
  events: TEvents;
}): {
  next: SSEEventBuffer;
  chunk?: SSEOutputChunk<TEvents>;
} {
  const { current, events } = args;
  if (!current.event) {
    return { next: { dataLines: [] } };
  }

  const schema = events[current.event as keyof TEvents];
  if (!schema) {
    return { next: { dataLines: [] } };
  }

  const eventName = current.event as Extract<keyof TEvents, string>;
  const payload = current.dataLines.join('\n');
  const next = { dataLines: [] };

  let parsed: unknown;
  try {
    parsed = payload ? JSON.parse(payload) : undefined;
  } catch {
    return { next };
  }

  const validated = validateStandardSync(schema, parsed, `sse.${eventName}`);
  if (!validated.ok) {
    return { next };
  }

  return {
    next,
    chunk: {
      type: 'event',
      name: eventName,
      data: validated.value as InferSchemaOutput<TEvents[keyof TEvents]>,
    },
  };
}

function pushSSEChunk<TEvents extends SchemaShape>(
  out: Array<SSEOutputChunk<TEvents>>,
  chunk: SSEOutputChunk<TEvents> | undefined,
): void {
  if (chunk) {
    out.push(chunk);
  }
}

function processSSELine<TEvents extends SchemaShape>(args: {
  rawLine: string;
  current: SSEEventBuffer;
  events: TEvents;
  out: Array<SSEOutputChunk<TEvents>>;
}): SSEEventBuffer {
  const line = args.rawLine.endsWith('\r')
    ? args.rawLine.slice(0, -1)
    : args.rawLine;

  if (!line) {
    const flushed = flushSSEEvent({
      current: args.current,
      events: args.events,
    });
    pushSSEChunk(args.out, flushed.chunk);
    return flushed.next;
  }

  if (line.startsWith('event:')) {
    return {
      ...args.current,
      event: line.slice('event:'.length).trim(),
    };
  }

  if (line.startsWith('data:')) {
    return {
      ...args.current,
      dataLines: [
        ...args.current.dataLines,
        line.slice('data:'.length).trimStart(),
      ],
    };
  }

  return args.current;
}

async function collectSSEEvents<TEvents extends SchemaShape>(
  response: Response,
  events: TEvents,
): Promise<Array<SSEOutputChunk<TEvents>>> {
  if (!response.body) return [];

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let current: SSEEventBuffer = { dataLines: [] };
  const out: Array<SSEOutputChunk<TEvents>> = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        current = processSSELine({ rawLine, current, events, out });
      }

      if (done) break;
    }

    if (current.event) {
      const flushed = flushSSEEvent({ current, events });
      pushSSEChunk(out, flushed.chunk);
    }

    return out;
  } finally {
    reader.releaseLock();
  }
}

function readSSEStream<TEvents extends SchemaShape>(
  response: Response,
  events: TEvents,
): AsyncIterable<
  SSEChunk<
    InferSchemaOutput<TEvents[keyof TEvents]>,
    Extract<keyof TEvents, string>
  >
> {
  const allEvents = collectSSEEvents(response, events);

  return {
    async *[Symbol.asyncIterator]() {
      const bufferedEvents = await allEvents;
      for (const event of bufferedEvents) {
        yield event;
      }
    },
  };
}

function validateAgainstOneOf<T>(
  schemas: readonly StandardSchemaLike[],
  value: unknown,
  context: string,
): { ok: true; value: T } | { ok: false; error: Error } {
  const errors: Error[] = [];

  for (const schema of schemas) {
    const validated = validateStandardSync(schema, value, context);
    if (validated.ok) {
      return { ok: true, value: validated.value as T };
    }

    errors.push(validated.error);
  }

  return {
    ok: false,
    error: new Error(
      `Validation Error (${context}): ${errors.map((error) => error.message).join(' | ')}`,
    ),
  };
}

async function createWebSocketClient(args: {
  baseURL: string;
  path: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  alias?: Record<string, string>;
  incoming: readonly StandardSchemaLike[];
  outgoing: readonly StandardSchemaLike[];
}): Promise<
  | {
      data: AsyncIterable<
        WSStatusChunk | WSMessageChunk<unknown> | WSErrorChunk
      >;
      controller: {
        send: (message: unknown) => void;
        close: (code?: number, reason?: string) => void;
      };
    }
  | { error: Error }
> {
  const url = buildURL({
    baseURL: args.baseURL,
    path: args.path,
    params: args.params,
    query: args.query,
    alias: args.alias,
  });

  const queue = createAsyncQueue<
    WSStatusChunk | WSMessageChunk<unknown> | WSErrorChunk
  >();
  queue.push({ type: 'status', status: 'connecting' });

  const wsURL = toWebSocketURL(url);
  const socket = new WebSocket(wsURL);

  let isOpen = false;

  const ready = new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => {
      isOpen = true;
      queue.push({ type: 'status', status: 'open' });
      resolve();
    });

    socket.addEventListener('error', () => {
      queue.push({ type: 'error', error: new Error('WebSocket error') });
      if (!isOpen) {
        reject(new Error('WebSocket connection failed'));
      }
    });
  });

  socket.addEventListener('message', (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(String(event.data));
      const validated = validateAgainstOneOf<unknown>(
        args.incoming,
        parsed,
        'websocket.incoming',
      );

      if (!validated.ok) {
        queue.push({ type: 'error', error: validated.error });
        return;
      }

      queue.push({ type: 'message', data: validated.value });
    } catch (error) {
      queue.push({
        type: 'error',
        error: toError(error, 'WebSocket message parse error'),
      });
    }
  });

  socket.addEventListener('close', () => {
    queue.push({ type: 'status', status: 'closed' });
    queue.close();
  });

  try {
    await ready;
  } catch (error) {
    return { error: toError(error, 'WebSocket connection failed') };
  }

  return {
    data: queue.iterable,
    controller: {
      send(message) {
        const validated = validateAgainstOneOf<unknown>(
          args.outgoing,
          message,
          'websocket.outgoing',
        );

        if (!validated.ok) {
          throw validated.error;
        }

        socket.send(JSON.stringify(validated.value));
      },
      close(code?: number, reason?: string) {
        socket.close(code, reason);
      },
    },
  };
}

function resolveClientRoute<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
  TPath extends PathsByMethod<TSchema, TMethod>,
>(
  apiSchema: TSchema,
  method: TMethod,
  path: TPath,
): RouteByMethodAndPath<TSchema, TMethod, TPath> | undefined {
  const exactRoute = findRouteByMethodAndPath(apiSchema, method, path);
  if (exactRoute) {
    return exactRoute as unknown as RouteByMethodAndPath<
      TSchema,
      TMethod,
      TPath
    >;
  }

  const routeWithSamePath = Object.values(apiSchema).find(
    (candidate) => candidate.path === path,
  );

  if (!routeWithSamePath) {
    return undefined;
  }

  return {
    method,
    path,
    input: undefined,
    response: undefined,
  } as RouteByMethodAndPath<TSchema, TMethod, TPath>;
}

async function invokeApiRoute<
  TSchema extends ApiSchema,
  TMethod extends HttpMethod,
  TPath extends PathsByMethod<TSchema, TMethod>,
>(args: {
  apiSchema: TSchema;
  baseURL: string;
  fetcher: FetchLike;
  alias?: Record<string, string>;
  method: TMethod;
  path: TPath;
  options?: RouteInputOptions<TPath, InputFor<TSchema, TMethod, TPath>>;
}): Promise<ClientResult<ResponseFor<TSchema, TMethod, TPath>>> {
  const route = resolveClientRoute(args.apiSchema, args.method, args.path);
  if (!route) {
    return { error: new Error(`path not found: ${String(args.path)}`) };
  }

  return executeHttpRoute({
    route,
    baseURL: args.baseURL,
    alias: args.alias,
    fetcher: args.fetcher,
    options: args.options,
  }) as Promise<ClientResult<ResponseFor<TSchema, TMethod, TPath>>>;
}

function createGetInvoker<TSchema extends ApiSchema>(args: {
  apiSchema: TSchema;
  baseURL: string;
  fetcher: FetchLike;
  alias?: Record<string, string>;
}) {
  return <const TPath extends PathsByMethod<TSchema, 'get'>>(
    path: TPath,
    ...optionArgs: CallOptionsTuple<TPath, InputFor<TSchema, 'get', TPath>>
  ) =>
    invokeApiRoute({
      apiSchema: args.apiSchema,
      baseURL: args.baseURL,
      fetcher: args.fetcher,
      alias: args.alias,
      method: 'get',
      path,
      options: optionArgs[0],
    });
}

function createPostInvoker<TSchema extends ApiSchema>(args: {
  apiSchema: TSchema;
  baseURL: string;
  fetcher: FetchLike;
  alias?: Record<string, string>;
}) {
  return <const TPath extends PathsByMethod<TSchema, 'post'>>(
    path: TPath,
    ...optionArgs: CallOptionsTuple<TPath, InputFor<TSchema, 'post', TPath>>
  ) =>
    invokeApiRoute({
      apiSchema: args.apiSchema,
      baseURL: args.baseURL,
      fetcher: args.fetcher,
      alias: args.alias,
      method: 'post',
      path,
      options: optionArgs[0],
    });
}

function createPutInvoker<TSchema extends ApiSchema>(args: {
  apiSchema: TSchema;
  baseURL: string;
  fetcher: FetchLike;
  alias?: Record<string, string>;
}) {
  return <const TPath extends PathsByMethod<TSchema, 'put'>>(
    path: TPath,
    ...optionArgs: CallOptionsTuple<TPath, InputFor<TSchema, 'put', TPath>>
  ) =>
    invokeApiRoute({
      apiSchema: args.apiSchema,
      baseURL: args.baseURL,
      fetcher: args.fetcher,
      alias: args.alias,
      method: 'put',
      path,
      options: optionArgs[0],
    });
}

function createDeleteInvoker<TSchema extends ApiSchema>(args: {
  apiSchema: TSchema;
  baseURL: string;
  fetcher: FetchLike;
  alias?: Record<string, string>;
}) {
  return <const TPath extends PathsByMethod<TSchema, 'delete'>>(
    path: TPath,
    ...optionArgs: CallOptionsTuple<TPath, InputFor<TSchema, 'delete', TPath>>
  ) =>
    invokeApiRoute({
      apiSchema: args.apiSchema,
      baseURL: args.baseURL,
      fetcher: args.fetcher,
      alias: args.alias,
      method: 'delete',
      path,
      options: optionArgs[0],
    });
}

export function createApiClient<const TSchema extends ApiSchema>(args: {
  apiSchema: TSchema;
  baseURL: string;
  fetch?: FetchLike;
  alias?: Record<string, string>;
}) {
  const fetcher: FetchLike = args.fetch ?? globalThis.fetch.bind(globalThis);

  const sharedArgs = {
    apiSchema: args.apiSchema,
    baseURL: args.baseURL,
    fetcher,
    alias: args.alias,
  };

  return {
    get: createGetInvoker(sharedArgs),
    post: createPostInvoker(sharedArgs),
    put: createPutInvoker(sharedArgs),
    delete: createDeleteInvoker(sharedArgs),
  };
}

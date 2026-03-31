import type { StandardSchemaV1 } from "@standard-schema/spec";

// ─── Schema / Stream Brands ────────────────────────────────────────

export interface BinaryStreamDef {
  readonly __type: "binary-stream";
  readonly contentType: string;
}

export interface JSONStreamDef<S extends StandardSchemaV1 = StandardSchemaV1> {
  readonly __type: "json-stream";
  readonly schema: S;
}

export interface SSEEventMap {
  [eventName: string]: StandardSchemaV1;
}

export interface SSEDef<E extends SSEEventMap = SSEEventMap> {
  readonly __type: "sse";
  readonly events: E;
}

export interface WebSocketDef<
  Server extends StandardSchemaV1[] = StandardSchemaV1[],
  Client extends StandardSchemaV1[] = StandardSchemaV1[],
> {
  readonly __type: "websocket";
  readonly serverSchemas: Server;
  readonly clientSchemas: Client;
}

export type StreamDef = BinaryStreamDef | JSONStreamDef | SSEDef | WebSocketDef;

// ─── Endpoint Definitions ──────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointInput {
  query?: Record<string, StandardSchemaV1>;
  json?: StandardSchemaV1;
  form?: Record<string, StandardSchemaV1>;
}

export interface EndpointDef<
  M extends HttpMethod = HttpMethod,
  P extends string = string,
  I extends EndpointInput | undefined = EndpointInput | undefined,
  R extends StandardSchemaV1 | StreamDef = StandardSchemaV1 | StreamDef,
> {
  readonly method: M;
  readonly path: P;
  readonly input: I;
  readonly response: R;
}

// ─── Path Parameter Extraction ─────────────────────────────────────

/** Extracts `:param` names from a path string. */
export type ExtractParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string }
  : P extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>;

/** Check if a path has params */
export type HasParams<P extends string> = P extends `${string}:${string}` ? true : false;

// ─── Infer schema output ───────────────────────────────────────────

export type InferOutput<S extends StandardSchemaV1> =
  S extends StandardSchemaV1<any, infer O> ? O : never;

// ─── API Schema ────────────────────────────────────────────────────

export type ApiSchema = Record<string, EndpointDef>;

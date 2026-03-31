import type { StandardSchemaV1 } from "@standard-schema/spec";

import type {
  BinaryStreamDef,
  EndpointDef,
  EndpointInput,
  JSONStreamDef,
  SSEDef,
  SSEEventMap,
  WebSocketDef,
} from "./types.ts";

// ─── Endpoint definers ─────────────────────────────────────────────

export function defineGet<
  P extends string,
  I extends EndpointInput | undefined = undefined,
  R extends StandardSchemaV1 | BinaryStreamDef | JSONStreamDef | SSEDef | WebSocketDef =
    | StandardSchemaV1
    | BinaryStreamDef
    | JSONStreamDef
    | SSEDef
    | WebSocketDef,
>(path: P, config: { input?: I; response: R }): EndpointDef<"GET", P, I, R> {
  return {
    method: "GET",
    path,
    input: config.input as I,
    response: config.response,
  };
}

export function definePost<
  P extends string,
  I extends EndpointInput | undefined = undefined,
  R extends StandardSchemaV1 = StandardSchemaV1,
>(path: P, config: { input?: I; response: R }): EndpointDef<"POST", P, I, R> {
  return {
    method: "POST",
    path,
    input: config.input as I,
    response: config.response,
  };
}

export function definePut<
  P extends string,
  I extends EndpointInput | undefined = undefined,
  R extends StandardSchemaV1 = StandardSchemaV1,
>(path: P, config: { input?: I; response: R }): EndpointDef<"PUT", P, I, R> {
  return {
    method: "PUT",
    path,
    input: config.input as I,
    response: config.response,
  };
}

export function definePatch<
  P extends string,
  I extends EndpointInput | undefined = undefined,
  R extends StandardSchemaV1 = StandardSchemaV1,
>(path: P, config: { input?: I; response: R }): EndpointDef<"PATCH", P, I, R> {
  return {
    method: "PATCH",
    path,
    input: config.input as I,
    response: config.response,
  };
}

export function defineDelete<
  P extends string,
  I extends EndpointInput | undefined = undefined,
  R extends StandardSchemaV1 = StandardSchemaV1,
>(path: P, config: { input?: I; response: R }): EndpointDef<"DELETE", P, I, R> {
  return {
    method: "DELETE",
    path,
    input: config.input as I,
    response: config.response,
  };
}

// ─── Stream / real-time markers ────────────────────────────────────

export function defineBinaryStream(contentType: string): BinaryStreamDef {
  return { __type: "binary-stream", contentType };
}

export function defineJSONStream<S extends StandardSchemaV1>(schema: S): JSONStreamDef<S> {
  return { __type: "json-stream", schema };
}

export function defineSSE<E extends SSEEventMap>(events: E): SSEDef<E> {
  return { __type: "sse", events };
}

export function defineWebSocket<
  Server extends StandardSchemaV1[],
  Client extends StandardSchemaV1[],
>(serverSchemas: [...Server], clientSchemas: [...Client]): WebSocketDef<Server, Client> {
  return { __type: "websocket", serverSchemas, clientSchemas };
}

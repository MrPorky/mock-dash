// Endpoint definition functions (re-exported from @mock-dash/core)
export {
  defineGet,
  definePost,
  definePut,
  definePatch,
  defineDelete,
  defineBinaryStream,
  defineJSONStream,
  defineSSE,
  defineWebSocket,
} from "@mock-dash/core";

// Error classes
export { ApiError, NetworkError, ValidationError } from "./errors.ts";

// Client factory
export { createApiClient } from "./client.ts";

// Types (re-export for consumers)
export type {
  ClientConfig,
  WebSocketController,
  ApiClient,
  InterceptorContext,
  RequestOptions,
  ResponseEnvelope,
  RequestInterceptorFn,
  ResponseInterceptorFn,
} from "./types.ts";

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

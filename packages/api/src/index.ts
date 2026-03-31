// Endpoint definition functions
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
} from "./define.ts";

// Error classes
export { ApiError, NetworkError, ValidationError } from "./errors.ts";

// Client factory
export { createApiClient } from "./client.ts";

// Types (re-export for consumers)
export type {
  ApiSchema,
  ClientConfig,
  EndpointDef,
  HttpMethod,
  WebSocketController,
  BinaryStreamDef,
  JSONStreamDef,
  SSEDef,
  WebSocketDef,
  ApiClient,
  InterceptorContext,
  RequestOptions,
  ResponseEnvelope,
  RequestInterceptorFn,
  ResponseInterceptorFn,
} from "./types.ts";

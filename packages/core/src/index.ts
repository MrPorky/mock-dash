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

// Types (re-export for consumers)
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
} from "./types.ts";

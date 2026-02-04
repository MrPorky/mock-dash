import type z from 'zod'
import { createApiClient } from './api-client/api-client'
import type { HttpErrorResult, HttpSuccessResult } from './api-client/http-call'
import type {
  StreamChunk,
  StreamErrorResult,
  StreamParseError,
  StreamSuccessResult,
} from './api-client/stream-call'
import type {
  WebSocketController,
  WSBinaryMessage,
  WSChunk,
  WSErrorResult,
  WSMessage,
  WSParseError,
  WSStatusUpdate,
  WSSuccessResult,
} from './api-client/ws-call'
import { createMockServer } from './create-mock-server/create-mock-server'
import {
  defineDelete,
  defineGet,
  definePatch,
  definePost,
  definePut,
} from './endpoint/define-endpoint'
import { Endpoint, type EndpointOptions } from './endpoint/endpoint'
import { HttpEndpoint } from './endpoint/http-endpoint'
import { StreamEndpoint } from './endpoint/stream-endpoint'
import {
  type BinaryStreamResponse,
  defineBinaryStream,
  defineJSONStream,
  defineSSE,
  type JSONStreamResponse,
  type SSEResponse,
} from './endpoint/stream-response'
import { WebSocketEndpoint } from './endpoint/ws-endpoint'
import { defineWebSocket, type WebSocketResponse } from './endpoint/ws-response'
import type { AliasOptionFromApiSchema } from './utils/alias'
import {
  ApiError,
  isApiError,
  isMockError,
  isNetworkError,
  isValidationError,
  MockError,
  NetworkError,
  ValidationError,
} from './utils/errors'

// Helper type aliases for user-friendly API
export type SSEResult<E extends Record<string, z.ZodType>> =
  | StreamSuccessResult<SSEResponse<E>>
  | StreamErrorResult

export type JSONStreamResult<I extends z.ZodType> =
  | StreamSuccessResult<JSONStreamResponse<I>>
  | StreamErrorResult

export type BinaryStreamResult =
  | StreamSuccessResult<BinaryStreamResponse>
  | StreamErrorResult

export type HttpResult<R extends z.ZodType> =
  | HttpSuccessResult<R>
  | HttpErrorResult

export type WSResult<
  S extends Array<z.ZodType> = Array<z.ZodType>,
  C extends Array<z.ZodType> = Array<z.ZodType>,
> = WSSuccessResult<WebSocketResponse<S, C>> | WSErrorResult

export {
  createApiClient,
  createMockServer,
  defineDelete,
  defineGet,
  definePatch,
  definePost,
  definePut,
  defineBinaryStream,
  defineJSONStream,
  defineSSE,
  defineWebSocket,
  ApiError,
  isApiError,
  isMockError,
  isNetworkError,
  isValidationError,
  MockError,
  NetworkError,
  ValidationError,
  Endpoint,
  HttpEndpoint,
  StreamEndpoint,
  WebSocketEndpoint,
}

export type {
  AliasOptionFromApiSchema,
  EndpointOptions,
  WebSocketController,
  // HTTP types
  HttpSuccessResult,
  HttpErrorResult,
  // Stream types
  StreamSuccessResult,
  StreamErrorResult,
  StreamChunk,
  StreamParseError,
  // WebSocket types
  WSSuccessResult,
  WSErrorResult,
  WSChunk,
  WSMessage,
  WSBinaryMessage,
  WSParseError,
  WSStatusUpdate,
  // Response schema types
  SSEResponse,
  JSONStreamResponse,
  BinaryStreamResponse,
  WebSocketResponse,
}

import { createApiClient } from './api-client/api-client'
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
  defineBinaryStream,
  defineJSONStream,
  defineSSE,
} from './endpoint/stream-response'
import { WebSocketEndpoint } from './endpoint/ws-endpoint'
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

export type { EndpointOptions }

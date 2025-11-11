import z from 'zod'
import type { EndpointInputType } from '../endpoint/input'
import type { WebSocketEndpoint } from '../endpoint/ws-endpoint'
import {
  isWebSocketResponse,
  type WebSocketResponse,
} from '../endpoint/ws-response'
import { buildEndpointPath } from '../utils/build-endpoint-path'
import { ApiError, NetworkError } from '../utils/errors'
import type {
  CreateApiClientArgs,
  EndpointArgs,
  FetchOptions,
} from './client-base'
import type { InterceptorManager } from './interceptor'

// Represents a successfully parsed message
type WebSocketMessage<T> = {
  type: 'message'
  /** The parsed and validated data */
  data: T
}

// Union of all possible received messages from the WebSocket
export type WSMessage<R extends WebSocketResponse> =
  R extends WebSocketResponse<infer S>
    ? WebSocketMessage<z.infer<z.ZodUnion<S>>>
    : never

// Binary data message type
export type WSBinaryMessage = {
  type: 'binary'
  /** The binary data received */
  data: ArrayBuffer | Blob | SharedArrayBuffer
}

// Error type for WebSocket message parsing
export type WSParseError = {
  type: 'error'
  error: Error
  /** The raw text that failed to parse */
  raw?: string
}

// Connection status updates
export type WSStatusUpdate = {
  type: 'status'
  status: 'connecting' | 'open' | 'closing' | 'closed'
}

// Union of all yielded items from the WebSocket generator
export type WSChunk<R extends WebSocketResponse<any>> =
  | WSMessage<R>
  | WSBinaryMessage
  | WSParseError
  | WSStatusUpdate

// WebSocket controller for sending messages and closing connection
export type WebSocketController<R extends WebSocketResponse<any>> = {
  send: (
    data: R extends WebSocketResponse<infer _S, infer C>
      ? z.infer<z.ZodUnion<C>>
      : never,
  ) => void
  sendRaw: (data: string | ArrayBuffer | Blob) => void
  close: (code?: number, reason?: string) => void
  readyState: number
}

// The successful return type from the call function
export type WSSuccessResult<R extends WebSocketResponse<any>> = {
  data: AsyncGenerator<WSChunk<R>, void, void>
  controller: WebSocketController<R>
  error?: never
}

// The error return type from the call function (e.g., connection failure)
export type WSErrorResult = {
  data?: never
  controller?: never
  error: ApiError | NetworkError
}

// The main call signature for a WebSocket endpoint
export type WebSocketEndpointCallSignature<
  R extends WebSocketResponse<any>,
  I extends EndpointInputType,
> = (...args: EndpointArgs<I>) => Promise<WSSuccessResult<R> | WSErrorResult>

/**
 * Main function to call a WebSocket endpoint.
 * It handles the connection and returns an AsyncGenerator for incoming messages.
 */
export function callWebSocketEndpoint(
  pathParams: Record<string, string>,
  endpoint: WebSocketEndpoint,
  requestOptions: Omit<
    CreateApiClientArgs,
    'apiSchema' | 'transformRequest' | 'transformResponse'
  >,
  _interceptors: {
    request: InterceptorManager<FetchOptions>
    response: InterceptorManager<Response>
  },
): WebSocketEndpointCallSignature<WebSocketResponse<any>, any> {
  return async (inputData) => {
    const schema = endpoint.response

    if (!isWebSocketResponse(schema)) {
      return {
        error: new ApiError('Invalid WebSocket response schema', 0, {
          method: endpoint.method,
        }),
      }
    }

    // Build the full URL
    let fullUrl = buildEndpointPath(
      endpoint.path,
      endpoint.options?.alias,
      requestOptions.baseURL,
    )

    // Replace path parameters
    for (const [key, value] of Object.entries(pathParams)) {
      fullUrl = fullUrl.replace(`:${key}`, String(value))
    }

    // Add query parameters if present
    if (inputData?.query) {
      const params = new URLSearchParams()
      Object.entries(inputData.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            for (const v of value) {
              params.append(key, String(v))
            }
          } else if (typeof value === 'object') {
            Object.entries(value).forEach(([subKey, subValue]) => {
              if (subValue !== undefined && subValue !== null) {
                params.append(`${key}[${subKey}]`, String(subValue))
              }
            })
          } else {
            params.append(key, String(value))
          }
        }
      })
      const queryString = params.toString()
      if (queryString) {
        fullUrl += `?${queryString}`
      }
    }

    // Convert http/https to ws/wss
    const wsUrl = fullUrl.replace(/^http/, 'ws')

    // Create WebSocket connection
    let ws: WebSocket
    try {
      // Note: WebSocket in browsers doesn't support custom headers directly
      // For authenticated WebSockets, use query parameters or protocols
      ws = new WebSocket(wsUrl)
    } catch (error) {
      return {
        error: new NetworkError(
          error instanceof Error
            ? error.message
            : 'WebSocket connection failed',
          { url: wsUrl, method: endpoint.method },
        ),
      }
    }

    // Create the async generator for messages
    const messageGenerator = wsMessageParser(ws, schema.serverToClient)

    // Create the controller for sending messages and closing the connection
    const controller: WebSocketController<WebSocketResponse<any>> = {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          const message = JSON.stringify(data)
          ws.send(message)
        } else {
          throw new Error(
            `WebSocket is not open. Current state: ${ws.readyState}`,
          )
        }
      },
      sendRaw: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        } else {
          throw new Error(
            `WebSocket is not open. Current state: ${ws.readyState}`,
          )
        }
      },
      close: (code, reason) => {
        ws.close(code, reason)
      },
      get readyState() {
        return ws.readyState
      },
    }

    return {
      data: messageGenerator,
      controller,
    }
  }
}

/**
 * Parses WebSocket messages as an async generator.
 */
async function* wsMessageParser<S extends Array<z.ZodType>>(
  ws: WebSocket,
  schemas: S,
): AsyncGenerator<WSChunk<WebSocketResponse<S>>, void, void> {
  // Queue for storing messages
  const messageQueue: (WSChunk<WebSocketResponse<S>> | null)[] = []
  let resolver: (() => void) | null = null
  let connectionError: Error | null = null

  // Yield initial connecting status
  yield { type: 'status', status: 'connecting' }

  // Set up event listeners
  ws.addEventListener('open', () => {
    messageQueue.push({ type: 'status', status: 'open' })
    if (resolver) {
      resolver()
      resolver = null
    }
  })

  ws.addEventListener('message', (event) => {
    const rawData = event.data

    // Handle binary data (ArrayBuffer, Blob, or TypedArray/DataView)
    if (
      rawData instanceof ArrayBuffer ||
      rawData instanceof Blob ||
      ArrayBuffer.isView(rawData)
    ) {
      // Convert TypedArray or DataView to ArrayBuffer
      const binaryData = ArrayBuffer.isView(rawData)
        ? rawData.buffer.slice(
            rawData.byteOffset,
            rawData.byteOffset + rawData.byteLength,
          )
        : rawData

      messageQueue.push({
        type: 'binary',
        data: binaryData,
      })

      if (resolver) {
        resolver()
        resolver = null
      }
      return
    }

    // Parse JSON message
    let parsedMessage: any
    try {
      parsedMessage = JSON.parse(rawData)
    } catch (error) {
      messageQueue.push({
        type: 'error',
        error:
          error instanceof Error
            ? error
            : new Error('Failed to parse WebSocket message as JSON'),
        raw: rawData,
      })

      if (resolver) {
        resolver()
        resolver = null
      }
      return
    }

    // Extract message type
    const messageType = parsedMessage.type
    if (!messageType) {
      messageQueue.push({
        type: 'error',
        error: new Error(
          'WebSocket message missing "type" field. Expected format: { type: "messageType", data: {...} }',
        ),
        raw: rawData,
      })

      if (resolver) {
        resolver()
        resolver = null
      }
      return
    }

    const validation = z.union(schemas).safeParse(parsedMessage.data)
    if (validation.success) {
      messageQueue.push({
        type: 'message',
        data: validation.data,
      })
    } else {
      messageQueue.push({
        type: 'error',
        error: validation.error,
        raw: rawData,
      })
    }

    if (resolver) {
      resolver()
      resolver = null
    }
  })

  ws.addEventListener('error', () => {
    connectionError = new Error('WebSocket error occurred')
    messageQueue.push({
      type: 'error',
      error: connectionError,
    })
    if (resolver) {
      resolver()
      resolver = null
    }
  })

  ws.addEventListener('close', () => {
    messageQueue.push({ type: 'status', status: 'closed' })
    // Signal end of stream
    messageQueue.push(null)
    if (resolver) {
      resolver()
      resolver = null
    }
  })

  // Yield messages from the queue
  while (true) {
    // Wait for messages if queue is empty
    if (messageQueue.length === 0) {
      await new Promise<void>((resolve) => {
        resolver = resolve
      })
    }

    // Process messages from queue
    while (messageQueue.length > 0) {
      const message = messageQueue.shift()

      // null signals the end of the stream
      if (message === null) {
        return
      }

      if (message !== undefined) {
        yield message
      }
    }
  }
}

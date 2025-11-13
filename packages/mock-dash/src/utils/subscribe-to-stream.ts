import type {
  StreamChunk,
  StreamParseError,
  StreamSuccessResult,
} from '../api-client/stream-call'
import type {
  WSChunk,
  WSParseError,
  WSSuccessResult,
} from '../api-client/ws-call'
import type { StreamResponse } from '../endpoint/stream-response'
import type { WebSocketResponse } from '../endpoint/ws-response'

/**
 * Callbacks for subscribing to a stream.
 */
export type StreamSubscription<R extends StreamResponse> = {
  /** Called for each successfully parsed data chunk */
  onMessage: (data: StreamChunk<R>) => void
  /** Called for any stream parsing or validation error */
  onError?: (error: StreamParseError) => void
  /** Called when the stream closes successfully */
  onClose?: () => void
}

/**
 * Callbacks for subscribing to a WebSocket stream.
 */
export type WebSocketSubscription<R extends WebSocketResponse<any>> = {
  /** Called for each successfully parsed data chunk */
  onMessage: (data: WSChunk<R>) => void
  /** Called for any WebSocket parsing or validation error */
  onError?: (error: WSParseError) => void
  /** Called when the WebSocket closes successfully */
  onClose?: () => void
}

/**
 * A utility to subscribe to a stream generator using callbacks.
 * This is an alternative to using a 'for await...of' loop.
 * @param streamResult The successful result from a stream call.
 * @param callbacks An object with onMessage, onError, and onClose handlers.
 * @returns A promise that resolves when the stream is closed.
 */
export async function subscribeToStream<R extends StreamResponse>(
  streamResult: StreamSuccessResult<R>,
  callbacks: StreamSubscription<R>,
): Promise<void>

/**
 * A utility to subscribe to a WebSocket stream generator using callbacks.
 * This is an alternative to using a 'for await...of' loop.
 * @param wsResult The successful result from a WebSocket call.
 * @param callbacks An object with onMessage, onError, and onClose handlers.
 * @returns A promise that resolves when the WebSocket is closed.
 */
export async function subscribeToStream<R extends WebSocketResponse<any>>(
  wsResult: WSSuccessResult<R>,
  callbacks: WebSocketSubscription<R>,
): Promise<void>

/**
 * A utility to subscribe to a stream generator using callbacks.
 * This is an alternative to using a 'for await...of' loop.
 * @param streamGenerator The `data` generator from a successful stream call.
 * @param callbacks An object with onMessage, onError, and onClose handlers.
 * @returns A promise that resolves when the stream is closed.
 */
export async function subscribeToStream<R extends StreamResponse>(
  streamGenerator: AsyncGenerator<
    StreamChunk<R> | StreamParseError,
    void,
    void
  >,
  callbacks: StreamSubscription<R>,
): Promise<void>

export async function subscribeToStream(
  input: any,
  callbacks: any,
): Promise<void> {
  let streamGenerator: AsyncGenerator<any, void, void>

  // Determine if input is a result object or a generator
  if (
    typeof input === 'object' &&
    input !== null &&
    'data' in input &&
    'error' in input
  ) {
    // It's a result object, extract the generator
    streamGenerator = input.data
  } else {
    // It's a generator directly
    streamGenerator = input
  }

  const { onMessage, onError, onClose } = callbacks

  try {
    for await (const chunk of streamGenerator) {
      if (chunk.type === 'error') {
        onError?.(chunk)
      } else {
        // chunk.type is 'event', 'json', 'binary', 'message', or 'status'
        // Type assertion is safe here due to the check above
        onMessage(chunk)
      }
    }
    // Stream finished without error
    onClose?.()
  } catch (error) {
    // Handle errors from the generator itself (e.g., network issues)
    const parseError = {
      type: 'error',
      error: error instanceof Error ? error : new Error('Unknown stream error'),
    }
    onError?.(parseError)
  }
}

// --- Add this helper function to your client ---

import type { StreamChunk, StreamParseError } from '../api-client/sse-call'
import type { StreamResponse } from '../endpoint/stream-response'

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
 * A utility to subscribe to a stream generator using callbacks.
 * This is an alternative to using a 'for await...of' loop.
 * * @param streamGenerator The `data` generator from a successful stream call.
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
): Promise<void> {
  const { onMessage, onError, onClose } = callbacks

  try {
    for await (const chunk of streamGenerator) {
      if (chunk.type === 'error') {
        onError?.(chunk)
      } else {
        // chunk.type is 'event', 'json', or 'binary'
        // Type assertion is safe here due to the check above
        onMessage(chunk)
      }
    }
    // Stream finished without error
    onClose?.()
  } catch (error) {
    // Handle errors from the generator itself (e.g., network issues)
    const parseError: StreamParseError = {
      type: 'error',
      error: error instanceof Error ? error : new Error('Unknown stream error'),
    }
    onError?.(parseError)
  }
}

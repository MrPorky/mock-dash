import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type {
  StreamChunk,
  StreamParseError,
} from '../../api-client/stream-call'
import {
  BinaryStreamResponse,
  JSONStreamResponse,
  SSEResponse,
} from '../../endpoint/stream-response'
import { subscribeToStream } from '../subscribe-to-stream'

function createSSEGenerator<R extends SSEResponse<any>>(
  chunks: Array<StreamChunk<R> | StreamParseError>,
): AsyncGenerator<StreamChunk<R> | StreamParseError, void, void> {
  async function* generator() {
    for (const chunk of chunks) {
      yield chunk
    }
  }
  return generator()
}

function createJSONStreamGenerator<R extends JSONStreamResponse<any>>(
  chunks: Array<StreamChunk<R> | StreamParseError>,
): AsyncGenerator<StreamChunk<R> | StreamParseError, void, void> {
  async function* generator() {
    for (const chunk of chunks) {
      yield chunk
    }
  }
  return generator()
}

function createBinaryStreamGenerator(
  chunks: Array<StreamChunk<BinaryStreamResponse> | StreamParseError>,
): AsyncGenerator<
  StreamChunk<BinaryStreamResponse> | StreamParseError,
  void,
  void
> {
  async function* generator() {
    for (const chunk of chunks) {
      yield chunk
    }
  }
  return generator()
}

// biome-ignore lint/correctness/useYield: This is intentional for the test
async function* createErrorGenerator(): AsyncGenerator<never, void, void> {
  throw new Error('Generator network error')
}

describe('subscribeToStream', () => {
  describe('SSE Stream', () => {
    it('should call onMessage for each successful SSE event', async () => {
      const schema = new SSEResponse({
        message: z.object({ text: z.string() }),
        update: z.object({ count: z.number() }),
      })

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'event',
          name: 'message',
          data: { text: 'Hello' },
          raw: '{"text":"Hello"}',
        },
        {
          type: 'event',
          name: 'update',
          data: { count: 42 },
          id: 'evt-1',
          raw: '{"count":42}',
        },
        {
          type: 'event',
          name: 'message',
          data: { text: 'World' },
          raw: '{"text":"World"}',
        },
      ]

      const generator = createSSEGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream<typeof schema>(generator, {
        onMessage,
        onError,
        onClose,
      })

      expect(onMessage).toHaveBeenCalledTimes(3)
      expect(onMessage).toHaveBeenNthCalledWith(1, chunks[0])
      expect(onMessage).toHaveBeenNthCalledWith(2, chunks[1])
      expect(onMessage).toHaveBeenNthCalledWith(3, chunks[2])
      expect(onError).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onError for SSE parse errors', async () => {
      const schema = new SSEResponse({
        message: z.object({ text: z.string() }),
      })

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'event',
          name: 'message',
          data: { text: 'Valid' },
          raw: '{"text":"Valid"}',
        },
        {
          type: 'error',
          error: new Error('Invalid JSON'),
          raw: '{invalid}',
        },
        {
          type: 'event',
          name: 'message',
          data: { text: 'After error' },
          raw: '{"text":"After error"}',
        },
      ]

      const generator = createSSEGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream<typeof schema>(generator, {
        onMessage,
        onError,
        onClose,
      })

      expect(onMessage).toHaveBeenCalledTimes(2)
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(chunks[1])
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('JSON Stream', () => {
    it('should call onMessage for each successful JSON item', async () => {
      const schema = new JSONStreamResponse(
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      )

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'json',
          data: { id: 1, name: 'Alice' },
          raw: '{"id":1,"name":"Alice"}',
        },
        {
          type: 'json',
          data: { id: 2, name: 'Bob' },
          raw: '{"id":2,"name":"Bob"}',
        },
        {
          type: 'json',
          data: { id: 3, name: 'Charlie' },
          raw: '{"id":3,"name":"Charlie"}',
        },
      ]

      const generator = createJSONStreamGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream<typeof schema>(generator, {
        onMessage,
        onError,
        onClose,
      })

      expect(onMessage).toHaveBeenCalledTimes(3)
      expect(onMessage).toHaveBeenNthCalledWith(1, chunks[0])
      expect(onMessage).toHaveBeenNthCalledWith(2, chunks[1])
      expect(onMessage).toHaveBeenNthCalledWith(3, chunks[2])
      expect(onError).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onError for JSON parse/validation errors', async () => {
      const schema = new JSONStreamResponse(
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      )

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'json',
          data: { id: 1, name: 'Valid' },
          raw: '{"id":1,"name":"Valid"}',
        },
        {
          type: 'error',
          error: new Error('Unexpected token'),
          raw: '{"id":2,name}',
        },
        {
          type: 'json',
          data: { id: 3, name: 'Another valid' },
          raw: '{"id":3,"name":"Another valid"}',
        },
      ]

      const generator = createJSONStreamGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream<typeof schema>(generator, {
        onMessage,
        onError,
        onClose,
      })

      expect(onMessage).toHaveBeenCalledTimes(2)
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(chunks[1])
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Binary Stream', () => {
    it('should call onMessage for each binary chunk', async () => {
      const schema = new BinaryStreamResponse()

      const chunk1 = new Uint8Array([1, 2, 3])
      const chunk2 = new Uint8Array([4, 5, 6, 7])
      const chunk3 = new Uint8Array([8, 9])

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        { type: 'binary', data: chunk1 },
        { type: 'binary', data: chunk2 },
        { type: 'binary', data: chunk3 },
      ]

      const generator = createBinaryStreamGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream<typeof schema>(generator, {
        onMessage,
        onError,
        onClose,
      })

      expect(onMessage).toHaveBeenCalledTimes(3)
      expect(onMessage).toHaveBeenNthCalledWith(1, chunks[0])
      expect(onMessage).toHaveBeenNthCalledWith(2, chunks[1])
      expect(onMessage).toHaveBeenNthCalledWith(3, chunks[2])
      expect(onError).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Generator Errors', () => {
    it('should call onError when the generator throws an error', async () => {
      const generator = createErrorGenerator()
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream(generator, { onMessage, onError, onClose })

      expect(onMessage).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith({
        type: 'error',
        error: expect.any(Error),
      })
      const errorArg = onError.mock.calls[0][0] as StreamParseError
      expect(errorArg.error.message).toBe('Generator network error')
      expect(onClose).not.toHaveBeenCalled()
    })

    it('should wrap non-Error throws in an Error object', async () => {
      // biome-ignore lint/correctness/useYield: This is intentional for the test
      async function* throwNonError(): AsyncGenerator<never, void, void> {
        throw 'String error'
      }

      const generator = throwNonError()
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream(generator, { onMessage, onError, onClose })

      expect(onError).toHaveBeenCalledTimes(1)
      const errorArg = onError.mock.calls[0][0] as StreamParseError
      expect(errorArg.type).toBe('error')
      expect(errorArg.error).toBeInstanceOf(Error)
      expect(errorArg.error.message).toBe('Unknown stream error')
    })
  })

  describe('Optional Callbacks', () => {
    it('should work without onError callback', async () => {
      const schema = new SSEResponse({
        message: z.object({ text: z.string() }),
      })

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'event',
          name: 'message',
          data: { text: 'Hello' },
          raw: '{"text":"Hello"}',
        },
        {
          type: 'error',
          error: new Error('Parse error'),
          raw: 'invalid',
        },
      ]

      const generator = createSSEGenerator(chunks)
      const onMessage = vi.fn()
      const onClose = vi.fn()

      await expect(
        subscribeToStream<typeof schema>(generator, { onMessage, onClose }),
      ).resolves.toBeUndefined()

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should work without onClose callback', async () => {
      const schema = new JSONStreamResponse(z.object({ id: z.number() }))

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        { type: 'json', data: { id: 1 }, raw: '{"id":1}' },
      ]

      const generator = createJSONStreamGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()

      await subscribeToStream<typeof schema>(generator, { onMessage, onError })

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onError).not.toHaveBeenCalled()
    })

    it('should work without both onError and onClose callbacks', async () => {
      const schema = new BinaryStreamResponse()

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        { type: 'binary', data: new Uint8Array([1, 2, 3]) },
      ]

      const generator = createBinaryStreamGenerator(chunks)
      const onMessage = vi.fn()

      await subscribeToStream<typeof schema>(generator, { onMessage })

      expect(onMessage).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty Stream', () => {
    it('should call onClose immediately for an empty stream', async () => {
      async function* emptyGenerator(): AsyncGenerator<never, void, void> {
        // Yields nothing
      }

      const generator = emptyGenerator()
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream(generator, { onMessage, onError, onClose })

      expect(onMessage).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Mixed Error and Success Chunks', () => {
    it('should handle a stream with alternating success and error chunks', async () => {
      const schema = new JSONStreamResponse(z.object({ value: z.string() }))

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        { type: 'json', data: { value: 'first' }, raw: '{"value":"first"}' },
        { type: 'error', error: new Error('Error 1'), raw: 'bad1' },
        { type: 'json', data: { value: 'second' }, raw: '{"value":"second"}' },
        { type: 'error', error: new Error('Error 2'), raw: 'bad2' },
        { type: 'json', data: { value: 'third' }, raw: '{"value":"third"}' },
      ]

      const generator = createJSONStreamGenerator(chunks)
      const onMessage = vi.fn()
      const onError = vi.fn()
      const onClose = vi.fn()

      await subscribeToStream<typeof schema>(generator, {
        onMessage,
        onError,
        onClose,
      })

      expect(onMessage).toHaveBeenCalledTimes(3)
      expect(onError).toHaveBeenCalledTimes(2)
      expect(onClose).toHaveBeenCalledTimes(1)

      expect(onMessage).toHaveBeenNthCalledWith(1, chunks[0])
      expect(onError).toHaveBeenNthCalledWith(1, chunks[1])
      expect(onMessage).toHaveBeenNthCalledWith(2, chunks[2])
      expect(onError).toHaveBeenNthCalledWith(2, chunks[3])
      expect(onMessage).toHaveBeenNthCalledWith(3, chunks[4])
    })
  })

  describe('Type Safety', () => {
    it('should correctly type SSE event data', async () => {
      const schema = new SSEResponse({
        user: z.object({ id: z.string(), name: z.string() }),
        status: z.object({ online: z.boolean() }),
      })

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'event',
          name: 'user',
          data: { id: 'u1', name: 'Alice' },
          raw: '{"id":"u1","name":"Alice"}',
        },
        {
          type: 'event',
          name: 'status',
          data: { online: true },
          raw: '{"online":true}',
        },
      ]

      const generator = createSSEGenerator(chunks)
      const messages: Array<StreamChunk<typeof schema>> = []

      await subscribeToStream<typeof schema>(generator, {
        onMessage: (chunk) => {
          messages.push(chunk)
          if (chunk.name === 'user') {
            expect(chunk.data).toHaveProperty('id')
            expect(chunk.data).toHaveProperty('name')
          } else if (chunk.name === 'status') {
            expect(chunk.data).toHaveProperty('online')
          }
        },
      })

      expect(messages).toHaveLength(2)
    })

    it('should correctly type JSON stream item data', async () => {
      const schema = new JSONStreamResponse(
        z.object({
          timestamp: z.number(),
          message: z.string(),
        }),
      )

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        {
          type: 'json',
          data: { timestamp: 123456, message: 'Test' },
          raw: '{"timestamp":123456,"message":"Test"}',
        },
      ]

      const generator = createJSONStreamGenerator(chunks)
      const messages: Array<StreamChunk<typeof schema>> = []

      await subscribeToStream<typeof schema>(generator, {
        onMessage: (chunk) => {
          messages.push(chunk)
          expect(typeof chunk.data.timestamp).toBe('number')
          expect(typeof chunk.data.message).toBe('string')
        },
      })

      expect(messages).toHaveLength(1)
    })

    it('should correctly type binary stream data', async () => {
      const schema = new BinaryStreamResponse()

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        { type: 'binary', data: new Uint8Array([1, 2, 3]) },
      ]

      const generator = createBinaryStreamGenerator(chunks)
      const messages: Array<StreamChunk<typeof schema>> = []

      await subscribeToStream<typeof schema>(generator, {
        onMessage: (chunk) => {
          messages.push(chunk)
          expect(chunk.data).toBeInstanceOf(Uint8Array)
        },
      })

      expect(messages).toHaveLength(1)
    })
  })

  describe('Promise Resolution', () => {
    it('should resolve the promise when the stream closes successfully', async () => {
      const schema = new JSONStreamResponse(z.object({ id: z.number() }))

      const chunks: Array<StreamChunk<typeof schema> | StreamParseError> = [
        { type: 'json', data: { id: 1 }, raw: '{"id":1}' },
      ]

      const generator = createJSONStreamGenerator(chunks)
      const onMessage = vi.fn()
      const onClose = vi.fn()

      const promise = subscribeToStream<typeof schema>(generator, {
        onMessage,
        onClose,
      })

      await expect(promise).resolves.toBeUndefined()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should resolve the promise even when generator throws', async () => {
      const generator = createErrorGenerator()
      const onMessage = vi.fn()
      const onError = vi.fn()

      const promise = subscribeToStream(generator, { onMessage, onError })

      await expect(promise).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledTimes(1)
    })
  })
})

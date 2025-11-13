import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { defineGet } from '../../endpoint/define-endpoint'
import { defineWebSocket } from '../../endpoint/ws-response'
import { ApiError, NetworkError } from '../../utils/errors'
import { createApiClient } from '../api-client'

// Simple event implementations for Node.js environment
class MockEvent {
  type: string
  constructor(type: string) {
    this.type = type
  }
}

class MockMessageEvent extends MockEvent {
  data: any
  constructor(type: string, options: { data?: any } = {}) {
    super(type)
    this.data = options.data
  }
}

class MockCloseEvent extends MockEvent {
  code: number
  reason: string
  constructor(type: string, options: { code?: number; reason?: string } = {}) {
    super(type)
    this.code = options.code ?? 1000
    this.reason = options.reason ?? ''
  }
}

// Mock WebSocket class for testing
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static lastInstance: MockWebSocket | null = null

  url: string
  readyState: number
  onopen: ((event: MockEvent) => void) | null = null
  onmessage: ((event: MockMessageEvent) => void) | null = null
  onerror: ((event: MockEvent) => void) | null = null
  onclose: ((event: MockCloseEvent) => void) | null = null
  private listeners: Map<
    string,
    Array<(event: MockEvent | MockMessageEvent | MockCloseEvent) => void>
  > = new Map()

  constructor(url: string) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    MockWebSocket.lastInstance = this
    // Simulate connection opening asynchronously
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.dispatchEvent(new MockEvent('open'))
    }, 0)
  }

  send(_data: string | ArrayBuffer | Blob) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // In tests, this would be overridden to simulate server responses
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      this.dispatchEvent(
        new MockCloseEvent('close', {
          code: code ?? 1000,
          reason: reason ?? '',
        }),
      )
    }, 0)
  }

  addEventListener(
    type: string,
    listener: (event: MockEvent | MockMessageEvent | MockCloseEvent) => void,
  ) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)?.push(listener)
  }

  dispatchEvent(event: MockEvent | MockMessageEvent | MockCloseEvent) {
    const listeners = this.listeners.get(event.type) || []
    for (const listener of listeners) {
      listener(event)
    }
    return true
  }

  simulateMessage(data: string) {
    this.dispatchEvent(new MockMessageEvent('message', { data }))
  }

  simulateError() {
    this.dispatchEvent(new MockEvent('error'))
  }
}

describe('WebSocket endpoints', () => {
  let originalWebSocket: typeof WebSocket

  beforeEach(() => {
    // Save original WebSocket and replace with mock
    originalWebSocket = global.WebSocket
    global.WebSocket = MockWebSocket as any
    MockWebSocket.lastInstance = null
  })

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket
  })

  it('should handle basic WebSocket endpoint', async () => {
    const apiSchema = {
      chatStream: defineGet('/chat', {
        input: { query: { userId: z.string() } },
        response: defineWebSocket(
          [
            z.object({
              id: z.string(),
              text: z.string(),
              timestamp: z.string(),
            }),
            z.object({ type: z.string(), content: z.string() }),
          ],
          [],
        ),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.chat.get.$ws({ query: { userId: '123' } })

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('controller')

    if (result.data && result.controller) {
      // Wait for connection to open
      const statusUpdates: string[] = []
      const messages: any[] = []

      // Simulate some messages
      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          ws.simulateMessage(
            JSON.stringify({ id: '1', text: 'Hello', timestamp: '2023-01-01' }),
          )
          ws.simulateMessage(
            JSON.stringify({ type: 'info', content: 'New user joined' }),
          )
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'status') statusUpdates.push(chunk.status)
        if (chunk.type === 'message') messages.push(chunk.data)
      }

      expect(statusUpdates).toContain('connecting')
      expect(statusUpdates).toContain('open')
      expect(statusUpdates).toContain('closed')
      expect(messages).toHaveLength(2)
    }
  }, 10000)

  it('should handle WebSocket with path parameters', async () => {
    const apiSchema = {
      userUpdates: defineGet('/users/:userId/updates', {
        response: defineWebSocket(
          [
            z.object({
              field: z.string(),
              value: z.string(),
            }),
          ],
          [],
        ),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.users.userId('user123').updates.get.$ws()

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('controller')

    if (result.controller) {
      // Verify the URL contains the path parameter
      const ws = MockWebSocket.lastInstance
      expect(ws?.url).toContain('user123')
    }
  })

  it('should send messages through controller', async () => {
    const apiSchema = {
      chatStream: defineGet('/chat', {
        response: defineWebSocket([], [z.object({ text: z.string() })]),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.chat.get.$ws()

    if (result.controller) {
      // Wait for connection to open
      await new Promise((resolve) => setTimeout(resolve, 10))

      const ws = MockWebSocket.lastInstance
      const sendSpy = vi.spyOn(ws!, 'send')

      result.controller.send({ text: 'Hello World' })

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ text: 'Hello World' }),
      )
    }
  })

  it('should handle malformed WebSocket messages', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ value: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const received: any[] = []
      const errors: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          ws.simulateMessage('{ invalid json }')
          ws.simulateMessage(JSON.stringify({ value: 'ok' }))
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'message') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }

      expect(received).toHaveLength(1)
      expect(errors.length).toBeGreaterThan(0)
    }
  }, 10000)

  it('should handle validation errors for invalid message data', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ value: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const errors: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send data that doesn't match the schema
          ws.simulateMessage(
            JSON.stringify({ type: 'update', data: { invalid: 'data' } }),
          )
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'error') errors.push(chunk.error)
      }

      expect(errors.length).toBeGreaterThan(0)
    }
  }, 10000)

  it('should handle WebSocket connection errors', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    // Mock WebSocket to throw error on construction
    global.WebSocket = class {
      constructor() {
        throw new Error('Connection failed')
      }
    } as any

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    expect(result).toHaveProperty('error')
    if (result.error) {
      expect(result.error).toBeInstanceOf(NetworkError)
    }
  })

  it('should close WebSocket connection via controller', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.controller && result.data) {
      // Wait for connection to open
      await new Promise((resolve) => setTimeout(resolve, 10))

      const ws = MockWebSocket.lastInstance
      const closeSpy = vi.spyOn(ws as any, 'close')

      result.controller.close(1000, 'Normal closure')

      expect(closeSpy).toHaveBeenCalledWith(1000, 'Normal closure')
    }
  })

  it('should handle query parameters', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        input: {
          query: {
            token: z.string(),
            room: z.string().optional(),
          },
        },
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws({
      query: { token: 'abc123', room: 'general' },
    })

    if (result.controller) {
      const ws = MockWebSocket.lastInstance
      expect(ws?.url).toContain('token=abc123')
      expect(ws?.url).toContain('room=general')
    }
  })

  it('should convert http to ws protocol', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost:3000',
    })

    const result = await client.updates.get.$ws()

    if (result.controller) {
      const ws = MockWebSocket.lastInstance
      expect(ws?.url).toMatch(/^ws:\/\//)
    }
  })

  it('should convert https to wss protocol', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'https://example.com',
    })

    const result = await client.updates.get.$ws()

    if (result.controller) {
      const ws = MockWebSocket.lastInstance
      expect(ws?.url).toMatch(/^wss:\/\//)
    }
  })

  it('should handle message validation errors', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket(
          [
            z.object({
              id: z.number(),
              text: z.string(),
            }),
          ],
          [],
        ),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const errors: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send message with wrong type (string instead of number for id)
          ws.simulateMessage(
            JSON.stringify({
              type: 'message',
              data: { id: 'not-a-number', text: 'test' },
            }),
          )
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'error') errors.push(chunk.error)
      }

      expect(errors.length).toBeGreaterThan(0)
    }
  }, 10000)

  it('should expose WebSocket readyState', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.controller) {
      expect(result.controller.readyState).toBeDefined()
      expect(typeof result.controller.readyState).toBe('number')
    }
  })

  it('should handle sendRaw for non-JSON messages', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.controller) {
      // Wait for connection to open
      await new Promise((resolve) => setTimeout(resolve, 10))

      const ws = MockWebSocket.lastInstance
      const sendSpy = vi.spyOn(ws as any, 'send')

      result.controller.sendRaw('raw message')

      expect(sendSpy).toHaveBeenCalledWith('raw message')
    }
  })

  it('should handle binary ArrayBuffer messages', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const binaryMessages: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send binary ArrayBuffer
          const buffer = new ArrayBuffer(8)
          const view = new Uint8Array(buffer)
          view.set([1, 2, 3, 4, 5, 6, 7, 8])
          ws.dispatchEvent(new MockMessageEvent('message', { data: buffer }))
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'binary') binaryMessages.push(chunk.data)
      }

      expect(binaryMessages).toHaveLength(1)
      expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer)
      expect(binaryMessages[0].byteLength).toBe(8)
    }
  }, 10000)

  it('should handle binary Blob messages', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const binaryMessages: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send binary Blob
          const blob = new Blob(['test data'], {
            type: 'application/octet-stream',
          })
          ws.dispatchEvent(new MockMessageEvent('message', { data: blob }))
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'binary') binaryMessages.push(chunk.data)
      }

      expect(binaryMessages).toHaveLength(1)
      expect(binaryMessages[0]).toBeInstanceOf(Blob)
    }
  }, 10000)

  it('should handle TypedArray messages (Uint8Array)', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const binaryMessages: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send TypedArray (Uint8Array)
          const typedArray = new Uint8Array([10, 20, 30, 40, 50])
          ws.dispatchEvent(
            new MockMessageEvent('message', { data: typedArray }),
          )
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'binary') binaryMessages.push(chunk.data)
      }

      expect(binaryMessages).toHaveLength(1)
      expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer)
      expect(binaryMessages[0].byteLength).toBe(5)

      // Verify the data is correct
      const view = new Uint8Array(binaryMessages[0])
      expect(Array.from(view)).toEqual([10, 20, 30, 40, 50])
    }
  }, 10000)

  it('should handle DataView messages', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const binaryMessages: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send DataView
          const buffer = new ArrayBuffer(16)
          const dataView = new DataView(buffer)
          dataView.setInt32(0, 42)
          dataView.setFloat32(4, 3.14)
          ws.dispatchEvent(new MockMessageEvent('message', { data: dataView }))
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'binary') binaryMessages.push(chunk.data)
      }

      expect(binaryMessages).toHaveLength(1)
      expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer)
      expect(binaryMessages[0].byteLength).toBe(16)

      // Verify the data is correct
      const view = new DataView(binaryMessages[0])
      expect(view.getInt32(0)).toBe(42)
      expect(view.getFloat32(4)).toBeCloseTo(3.14, 2)
    }
  }, 10000)

  it('should handle mixed JSON and binary messages', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const jsonMessages: any[] = []
      const binaryMessages: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send JSON message
          ws.simulateMessage(JSON.stringify({ text: 'hello' }))

          // Send binary message
          const buffer = new ArrayBuffer(4)
          ws.dispatchEvent(new MockMessageEvent('message', { data: buffer }))

          // Send another JSON message
          ws.simulateMessage(JSON.stringify({ text: 'world' }))

          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'message') jsonMessages.push(chunk.data)
        if (chunk.type === 'binary') binaryMessages.push(chunk.data)
      }

      expect(jsonMessages).toHaveLength(2)
      expect(jsonMessages[0]).toEqual({ text: 'hello' })
      expect(jsonMessages[1]).toEqual({ text: 'world' })
      expect(binaryMessages).toHaveLength(1)
      expect(binaryMessages[0]).toBeInstanceOf(ArrayBuffer)
    }
  }, 10000)

  it('should handle array query parameters', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        input: {
          query: {
            tags: z.array(z.string()).optional(),
          },
        },
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws({
      query: { tags: ['important', 'urgent'] },
    })

    if (result.controller) {
      const ws = MockWebSocket.lastInstance
      expect(ws?.url).toContain('tags=important')
      expect(ws?.url).toContain('tags=urgent')
    }
  })

  it('should handle object query parameters', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        input: {
          query: {
            filter: z
              .object({
                status: z.string(),
                priority: z.number(),
              })
              .optional(),
          },
        },
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws({
      query: {
        filter: {
          status: 'active',
          priority: 1,
        },
      },
    })

    if (result.controller) {
      const ws = MockWebSocket.lastInstance
      // URLs are encoded, so check for encoded brackets
      expect(ws?.url).toContain('filter%5Bstatus%5D=active')
      expect(ws?.url).toContain('filter%5Bpriority%5D=1')
    }
  })

  it('should handle sending message when WebSocket is closed', async () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        response: defineWebSocket([], [z.object({ message: z.string() })]),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.chat.get.$ws()

    if (result.controller) {
      // Wait for connection to open
      await new Promise((resolve) => setTimeout(resolve, 10))

      const ws = MockWebSocket.lastInstance
      // Close the WebSocket
      ws?.close()

      // Wait for close to complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(() => {
        result.controller.send({ message: 'test' })
      }).toThrow('WebSocket is not open')
    }
  })

  it('should handle sendRaw when WebSocket is closed', async () => {
    const apiSchema = {
      chat: defineGet('/chat', {
        response: defineWebSocket([], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.chat.get.$ws()

    if (result.controller) {
      // Wait for connection to open
      await new Promise((resolve) => setTimeout(resolve, 10))

      const ws = MockWebSocket.lastInstance
      // Close the WebSocket
      ws?.close()

      // Wait for close to complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(() => {
        result.controller.sendRaw('test message')
      }).toThrow('WebSocket is not open')
    }
  })

  it('should handle WebSocket error events', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const errors: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Simulate WebSocket error
          ws.simulateError()
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'error') errors.push(chunk.error)
      }

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe('WebSocket error occurred')
    }
  }, 10000)

  it('should handle non-Error instances in JSON parse errors', async () => {
    // Mock JSON.parse to throw a non-Error instance
    const originalParse = JSON.parse
    JSON.parse = vi.fn().mockImplementationOnce(() => {
      throw 'This is not an Error instance'
    })

    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    if (result.data) {
      const errors: any[] = []

      setTimeout(() => {
        const ws = MockWebSocket.lastInstance
        if (ws) {
          // Send invalid JSON that will trigger our mocked JSON.parse
          ws.simulateMessage('invalid json')
          ws.close()
        }
      }, 50)

      for await (const chunk of result.data) {
        if (chunk.type === 'error') errors.push(chunk.error)
      }

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toBe(
        'Failed to parse WebSocket message as JSON',
      )
    }

    // Restore original JSON.parse
    JSON.parse = originalParse
  }, 10000)

  it('should handle non-Error instances in WebSocket constructor', async () => {
    const apiSchema = {
      updates: defineGet('/updates', {
        response: defineWebSocket([z.object({ text: z.string() })], []),
      }),
    }

    // Mock WebSocket to throw a non-Error instance
    global.WebSocket = class {
      constructor() {
        throw 'Connection failed - not an error instance'
      }
    } as any

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
    })

    const result = await client.updates.get.$ws()

    expect(result).toHaveProperty('error')
    if (result.error) {
      expect(result.error).toBeInstanceOf(NetworkError)
      expect(result.error.message).toBe('WebSocket connection failed')
    }
  })

  it('should handle invalid WebSocket response schema', async () => {
    // Create a mock endpoint with an invalid schema (not a WebSocket response)
    const mockEndpoint = {
      method: 'GET',
      path: '/updates',
      response: z.string(), // This is not a WebSocket response schema
    }

    // We'll need to call the function directly since the client builder validates schemas
    const { callWebSocketEndpoint } = await import('../ws-call')

    const callFunction = callWebSocketEndpoint(
      {},
      mockEndpoint as any,
      { baseURL: 'http://localhost' },
      {
        request: { use: () => {}, interceptors: [] } as any,
        response: { use: () => {}, interceptors: [] } as any,
      },
    )

    const result = await callFunction(undefined as any)

    expect(result).toHaveProperty('error')
    if (result.error) {
      expect(result.error).toBeInstanceOf(ApiError)
      expect(result.error.message).toBe('Invalid WebSocket response schema')
    }
  })
})

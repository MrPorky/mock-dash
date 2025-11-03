import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { defineGet } from '../../http-endpoint/define-http-endpoint'
import { defineSSE } from '../../http-endpoint/stream-response'
import { ApiError, NetworkError } from '../../utils/errors'
import { createApiClient } from '../api-client'

describe('Server-Sent Events (SSE)', () => {
  it('should handle basic SSE endpoint', async () => {
    const apiSchema = {
      notificationStream: defineGet('/events/notifications', {
        input: { query: { userId: z.string() } },
        response: defineSSE({
          notification: z.object({
            id: z.string(),
            message: z.string(),
            timestamp: z.string(),
          }),
          heartbeat: z.object({ status: z.literal('alive') }),
        }),
      }),
    }
    const app = new Hono().get(
      '/events/notifications',
      zValidator('query', z.object(apiSchema.notificationStream.input?.query)),
      (c) =>
        streamSSE(c, async (stream) => {
          await stream.writeSSE({
            event: 'notification',
            data: JSON.stringify({
              id: '1',
              message: 'New notification',
              timestamp: '2023-01-01T00:00:00Z',
            }),
          })
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ status: 'alive' }),
          })
        }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const received: any[] = []
    const errors: any[] = []
    let closed = false
    const result = await client.events.notifications.get.$stream({
      query: { userId: '123' },
    })
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
      closed = true
    }
    expect(received).toHaveLength(2)
    expect(errors).toHaveLength(0)
    expect(closed).toBe(true)
  })

  it('should handle SSE with path parameters', async () => {
    const apiSchema = {
      userEvents: defineGet('/users/:userId/events', {
        input: { query: { since: z.string().optional() } },
        response: defineSSE({
          userUpdate: z.object({
            userId: z.string(),
            field: z.string(),
            newValue: z.string(),
          }),
          userAction: z.object({
            userId: z.string(),
            action: z.string(),
            timestamp: z.string(),
          }),
        }),
      }),
    }
    const app = new Hono().get(
      '/users/:userId/events',
      zValidator('query', z.object(apiSchema.userEvents.input?.query)),
      (c) =>
        streamSSE(c, async (stream) => {
          await stream.writeSSE({
            event: 'userUpdate',
            data: JSON.stringify({
              userId: 'user123',
              field: 'name',
              newValue: 'John Smith',
            }),
          })
          await stream.writeSSE({
            event: 'userAction',
            data: JSON.stringify({
              userId: 'user123',
              action: 'login',
              timestamp: '2023-01-01T12:00:00Z',
            }),
          })
        }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const received: any[] = []
    const errors: any[] = []
    let closed = false
    const result = await client.users
      .userId('user123')
      .events.get.$stream({ query: { since: '2023-01-01' } })
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
      closed = true
    }
    expect(received).toHaveLength(2)
    expect(errors).toHaveLength(0)
    expect(closed).toBe(true)
  })

  it('should handle SSE connection errors', async () => {
    const apiSchema = {
      streamEvents: defineGet('/events', {
        response: defineSSE({ message: z.object({ content: z.string() }) }),
      }),
    }
    const app = new Hono().get('/events', (c) => c.text('Server Error', 500))
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const errors: any[] = []
    const result = await client.events.get.$stream()
    if (result.error) errors.push(result.error)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(ApiError)
    expect(errors[0].status).toBe(500)
  })

  it('should handle SSE network errors', async () => {
    const apiSchema = {
      streamEvents: defineGet('/events', {
        response: defineSSE({ message: z.object({ content: z.string() }) }),
      }),
    }
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network error'))
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: mockFetch,
    })
    const res = await client.events.get.$stream()
    expect(res).toHaveProperty('error')
    if (res.error) expect(res.error).toBeInstanceOf(NetworkError)
  })

  it('should handle malformed SSE data', async () => {
    const apiSchema = {
      streamEvents: defineGet('/events', {
        response: defineSSE({ validEvent: z.object({ message: z.string() }) }),
      }),
    }
    const app = new Hono().get('/events', (c) =>
      streamSSE(c, async (stream) => {
        await stream.writeSSE({ data: '{ invalid json }' })
        await stream.writeSSE({
          event: 'validEvent',
          data: JSON.stringify({ message: 'valid' }),
        })
      }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const received: any[] = []
    const errors: any[] = []
    let closed = false
    const result = await client.events.get.$stream()
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
      closed = true
    }
    expect(received).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(closed).toBe(true)
  })

  it('should handle SSE with custom headers and interceptors', async () => {
    const apiSchema = {
      secureEvents: defineGet('/secure/events', {
        input: { query: { token: z.string() } },
        response: defineSSE({
          secureMessage: z.object({ encrypted: z.string() }),
        }),
      }),
    }
    const app = new Hono().get(
      '/secure/events',
      zValidator('query', z.object(apiSchema.secureEvents.input?.query)),
      (c) => {
        expect(c.req.header('Authorization')).toBe('Bearer token123')
        expect(c.req.header('X-Custom-Header')).toBe('custom-value')
        return streamSSE(c, async (stream) => {
          await stream.writeSSE({
            event: 'secureMessage',
            data: JSON.stringify({ encrypted: 'encrypted-data' }),
          })
        })
      },
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const requestInterceptor = vi.fn((_ctx, options) => ({
      ...options,
      headers: { ...options.headers, Authorization: 'Bearer token123' },
    }))
    client.interceptors.request.use(requestInterceptor)
    const received: any[] = []
    const errors: any[] = []
    const result = await client.secure.events.get.$stream({
      query: { token: 'abc123' },
      headers: { 'X-Custom-Header': 'custom-value' },
    })
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
    }
    expect(requestInterceptor).toHaveBeenCalled()
    expect(received).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('should support AbortSignal for SSE connections', async () => {
    const apiSchema = {
      streamEvents: defineGet('/events', {
        response: defineSSE({ message: z.object({ content: z.string() }) }),
      }),
    }
    const mockFetch = vi.fn().mockImplementation((request: Request) => {
      if (request.signal?.aborted)
        return Promise.reject(new DOMException('Request aborted', 'AbortError'))
      const stream = new ReadableStream({ start() {} })
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
    })
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: mockFetch,
    })
    const controller = new AbortController()
    controller.abort()
    const res = await client.events.get.$stream({ signal: controller.signal })
    expect(res).toHaveProperty('error')
    if (res.error) expect(res.error).toBeInstanceOf(NetworkError)
  })

  it('should handle multiple event types correctly', async () => {
    const apiSchema = {
      multiEvents: defineGet('/multi-events', {
        response: defineSSE({
          typeA: z.object({ type: z.literal('A'), data: z.string() }),
          typeB: z.object({ type: z.literal('B'), value: z.number() }),
          typeC: z.object({ type: z.literal('C'), items: z.array(z.string()) }),
        }),
      }),
    }
    const app = new Hono().get('/multi-events', (c) =>
      streamSSE(c, async (stream) => {
        await stream.writeSSE({
          event: 'typeA',
          data: JSON.stringify({ type: 'A', data: 'string data' }),
        })
        await stream.writeSSE({
          event: 'typeB',
          data: JSON.stringify({ type: 'B', value: 42 }),
        })
        await stream.writeSSE({
          event: 'typeC',
          data: JSON.stringify({ type: 'C', items: ['item1', 'item2'] }),
        })
      }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const received: any[] = []
    const errors: any[] = []
    const result = await client['multi-events'].get.$stream()
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
    }
    expect(received).toHaveLength(3)
    expect(errors).toHaveLength(0)
  })
})

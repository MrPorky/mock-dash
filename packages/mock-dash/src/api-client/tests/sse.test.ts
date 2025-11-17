import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { defineGet } from '../../endpoint/define-endpoint'
import { defineSSE } from '../../endpoint/stream-response'
import { ApiError, type Errors, NetworkError } from '../../utils/errors'
import { createApiClient } from '../api-client'

describe('Server-Sent Events (SSE)', () => {
  it('should handle basic SSE endpoint', async () => {
    const eventSchema = {
      notification: z.object({
        id: z.string(),
        message: z.string(),
        timestamp: z.string(),
      }),
      heartbeat: z.object({ status: z.literal('alive') }),
    }
    const apiSchema = {
      notificationStream: defineGet('/events/notifications', {
        input: { query: { userId: z.string() } },
        response: defineSSE(eventSchema),
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
    const receivedNotifications: (typeof client.infer.events.notifications.get.$stream.response.notification)[] =
      []
    const receivedHeartbeats: (typeof client.infer.events.notifications.get.$stream.response.heartbeat)[] =
      []
    const errors: Errors[] = []
    let closed = false
    const result = await client.api.events.notifications.get.$stream({
      query: { userId: '123' },
    })
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') {
          if (chunk.name === 'notification')
            receivedNotifications.push(chunk.data)
          if (chunk.name === 'heartbeat') receivedHeartbeats.push(chunk.data)
        }
        if (chunk.type === 'error') errors.push(chunk.error)
      }
      closed = true
    }
    expect(receivedNotifications).toHaveLength(1)
    expect(receivedHeartbeats).toHaveLength(1)
    expect(errors).toHaveLength(0)
    expect(closed).toBe(true)
  })

  it('should handle SSE with path parameters', async () => {
    const eventSchema = {
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
    }
    const apiSchema = {
      userEvents: defineGet('/users/:userId/events', {
        input: { query: { since: z.string().optional() } },
        response: defineSSE(eventSchema),
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
    const receivedUpdates: z.infer<typeof eventSchema.userUpdate>[] = []
    const receivedActions: z.infer<typeof eventSchema.userAction>[] = []
    const errors: Errors[] = []
    let closed = false
    const result = await client.api.users
      .userId('user123')
      .events.get.$stream({ query: { since: '2023-01-01' } })
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') {
          if (chunk.name === 'userUpdate') receivedUpdates.push(chunk.data)
          if (chunk.name === 'userAction') receivedActions.push(chunk.data)
        }
        if (chunk.type === 'error') errors.push(chunk.error)
      }
      closed = true
    }
    expect(receivedUpdates).toHaveLength(1)
    expect(receivedActions).toHaveLength(1)
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
    const errors: Errors[] = []
    const result = await client.api.events.get.$stream()
    if (result.error) errors.push(result.error)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(ApiError)
    expect((errors[0] as ApiError).status).toBe(500)
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
    const res = await client.api.events.get.$stream()
    expect(res).toHaveProperty('error')
    if (res.error) expect(res.error).toBeInstanceOf(NetworkError)
  })

  it('should handle malformed SSE data', async () => {
    const validationEventModel = z.object({ message: z.string() })
    const apiSchema = {
      streamEvents: defineGet('/events', {
        response: defineSSE({ validEvent: validationEventModel }),
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
    const received: z.infer<typeof validationEventModel>[] = []
    const errors: Errors[] = []
    let closed = false
    const result = await client.api.events.get.$stream()
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
    const received: { encrypted: string }[] = []
    const errors: Errors[] = []
    const result = await client.api.secure.events.get.$stream({
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
    const res = await client.api.events.get.$stream({
      signal: controller.signal,
    })
    expect(res).toHaveProperty('error')
    if (res.error) expect(res.error).toBeInstanceOf(NetworkError)
  })

  it('should handle multiple event types correctly', async () => {
    const eventSchema = {
      typeA: z.object({ type: z.literal('A'), data: z.string() }),
      typeB: z.object({ type: z.literal('B'), value: z.number() }),
      typeC: z.object({ type: z.literal('C'), items: z.array(z.string()) }),
    }
    const apiSchema = {
      multiEvents: defineGet('/multi-events', {
        response: defineSSE(eventSchema),
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
    const receivedA: z.infer<typeof eventSchema.typeA>[] = []
    const receivedB: z.infer<typeof eventSchema.typeB>[] = []
    const receivedC: z.infer<typeof eventSchema.typeC>[] = []
    const errors: Errors[] = []
    const result = await client.api.multiEvents.get.$stream()
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'event') {
          if (chunk.name === 'typeA') receivedA.push(chunk.data)
          if (chunk.name === 'typeB') receivedB.push(chunk.data)
          if (chunk.name === 'typeC') receivedC.push(chunk.data)
        }
        if (chunk.type === 'error') errors.push(chunk.error)
      }
    }
    expect(receivedA).toHaveLength(1)
    expect(receivedB).toHaveLength(1)
    expect(receivedC).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })
})

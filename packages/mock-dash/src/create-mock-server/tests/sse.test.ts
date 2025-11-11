import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineGet, definePost } from '../../endpoint/define-endpoint'
import { defineSSE } from '../../endpoint/stream-response'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - SSE endpoints', () => {
  it('should stream SSE events with schema validation', async () => {
    const apiSchema = {
      notificationStream: defineGet('/events/notifications', {
        response: defineSSE({
          notification: z.object({
            id: z.string(),
            message: z.string(),
          }),
          heartbeat: z.object({
            status: z.literal('alive'),
          }),
        }),
      }),
    }

    apiSchema.notificationStream.defineMock(async ({ stream }) => {
      await stream.write({
        event: 'notification',
        data: { id: '1', message: 'First notification' },
      })
      await stream.write({
        event: 'heartbeat',
        data: { status: 'alive' as const },
      })
      await stream.write({
        event: 'notification',
        data: { id: '2', message: 'Second notification' },
      })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/events/notifications')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const text = await response.text()
    expect(text).toContain('event: notification')
    expect(text).toContain('data: {"id":"1","message":"First notification"}')
    expect(text).toContain('event: heartbeat')
    expect(text).toContain('data: {"status":"alive"}')
  })

  it('should use zodToMock for default SSE values', async () => {
    const apiSchema = {
      statusStream: defineGet('/status', {
        response: defineSSE({
          status: z.object({
            code: z.number(),
            text: z.string(),
          }),
        }),
      }),
    }

    const app = createMockServer(apiSchema, {
      zodToMock: (schema) => {
        if (schema instanceof z.ZodObject) {
          return {
            code: 200,
            text: 'OK',
          } as z.infer<typeof schema>
        }
        return undefined as any
      },
    })

    const response = await app.request('/status')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('event: status')
    expect(text).toContain('data: {"code":200,"text":"OK"}')
  })

  it('should handle empty SSE stream', async () => {
    const apiSchema = {
      emptyStream: defineGet('/events/empty', {
        response: defineSSE({
          message: z.object({ content: z.string() }),
        }),
      }),
    }

    apiSchema.emptyStream.defineMock(async () => {
      // Write nothing
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/events/empty')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('')
  })

  it('should support query parameters with SSE', async () => {
    const apiSchema = {
      filteredEvents: defineGet('/events/filtered', {
        input: {
          query: {
            category: z.string(),
            limit: z.coerce.number(),
          },
        },
        response: defineSSE({
          event: z.object({
            id: z.number(),
            category: z.string(),
            data: z.string(),
          }),
        }),
      }),
    }

    apiSchema.filteredEvents.defineMock(async ({ inputs, stream }) => {
      const { category, limit } = inputs.query
      for (let i = 1; i <= limit; i++) {
        await stream.write({
          event: 'event',
          data: {
            id: i,
            category,
            data: `Event ${i}`,
          },
        })
      }
    })

    const app = createMockServer(apiSchema)
    const response = await app.request(
      '/events/filtered?category=alerts&limit=3',
    )

    expect(response.status).toBe(200)
    const text = await response.text()

    // Check all three events are present
    expect(text.match(/event: event/g)).toHaveLength(3)
    expect(text).toContain('"category":"alerts"')
  })

  it('should support POST with SSE response', async () => {
    const apiSchema = {
      subscribeToUpdates: definePost('/subscribe', {
        input: {
          json: z.object({
            topics: z.array(z.string()),
          }),
        },
        response: defineSSE({
          update: z.object({
            topic: z.string(),
            content: z.string(),
          }),
        }),
      }),
    }

    apiSchema.subscribeToUpdates.defineMock(async ({ inputs, stream }) => {
      const { topics } = inputs.json
      for (const topic of topics) {
        await stream.write({
          event: 'update',
          data: {
            topic,
            content: `Update for ${topic}`,
          },
        })
      }
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: ['news', 'weather'] }),
    })

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('"topic":"news"')
    expect(text).toContain('"topic":"weather"')
  })

  it('should support multiple event types in SSE', async () => {
    const apiSchema = {
      mixedEvents: defineGet('/events/mixed', {
        response: defineSSE({
          message: z.object({ text: z.string() }),
          notification: z.object({ title: z.string(), body: z.string() }),
          heartbeat: z.object({ timestamp: z.number() }),
        }),
      }),
    }

    apiSchema.mixedEvents.defineMock(async ({ stream }) => {
      await stream.write({
        event: 'message',
        data: { text: 'Hello' },
      })
      await stream.write({
        event: 'notification',
        data: { title: 'Alert', body: 'Important update' },
      })
      await stream.write({
        event: 'heartbeat',
        data: { timestamp: Date.now() },
      })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/events/mixed')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('event: message')
    expect(text).toContain('event: notification')
    expect(text).toContain('event: heartbeat')
  })

  it('should support SSE with id and retry fields', async () => {
    const apiSchema = {
      stableStream: defineGet('/events/stable', {
        response: defineSSE({
          data: z.object({ value: z.number() }),
        }),
      }),
    }

    apiSchema.stableStream.defineMock(async ({ stream }) => {
      await stream.write({
        event: 'data',
        data: { value: 1 },
        id: 'msg-1',
        retry: 5000,
      })
      await stream.write({
        event: 'data',
        data: { value: 2 },
        id: 'msg-2',
      })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/events/stable')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('id: msg-1')
    expect(text).toContain('retry: 5000')
    expect(text).toContain('id: msg-2')
  })

  it('should support async SSE mock with path parameters', async () => {
    const apiSchema = {
      userEventStream: defineGet('/users/:userId/events', {
        response: defineSSE({
          userEvent: z.object({
            userId: z.string(),
            action: z.string(),
          }),
        }),
      }),
    }

    apiSchema.userEventStream.defineMock(async ({ inputs, stream }) => {
      const userId = (inputs.param as { userId: string }).userId

      // Simulate async data fetching
      await new Promise((resolve) => setTimeout(resolve, 10))

      await stream.write({
        event: 'userEvent',
        data: {
          userId,
          action: 'logged in',
        },
      })
      await stream.write({
        event: 'userEvent',
        data: {
          userId,
          action: 'updated profile',
        },
      })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/users/user123/events')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('"userId":"user123"')
    expect(text).toContain('"action":"logged in"')
    expect(text).toContain('"action":"updated profile"')
  })
})

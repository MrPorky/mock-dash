import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineGet } from '../../endpoint/define-endpoint'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - GET endpoints', () => {
  it('should handle GET request without mock using zodToMock', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().email(),
        }),
      }),
    }

    const app = createMockServer(apiSchema, {
      zodToMock: (schema) => {
        if (schema instanceof z.ZodObject) {
          return {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
          } as z.infer<typeof schema>
        }
        return '' as any
      },
    })

    const res = await app.request('/users/123')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    })
  })

  it('should handle GET request with defined mock', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({
          id: z.string(),
          name: z.string(),
        }),
      }),
    }

    apiSchema.getUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      name: 'Jane Smith',
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/456')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      id: '456',
      name: 'Jane Smith',
    })
  })

  it('should handle GET request with query parameters', async () => {
    const apiSchema = {
      searchUsers: defineGet('/users/search', {
        input: {
          query: {
            q: z.string(),
            limit: z.string().optional(),
          },
        },
        response: z.object({
          results: z.array(z.object({ id: z.string(), name: z.string() })),
          total: z.number(),
        }),
      }),
    }

    apiSchema.searchUsers.defineMock((ctx) => ({
      results: [
        { id: '1', name: `Search result for: ${ctx.inputs.query.q}` },
        { id: '2', name: 'Another result' },
      ],
      total: 2,
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/search?q=john&limit=10')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.results).toHaveLength(2)
    expect(data.results[0].name).toContain('john')
    expect(data.total).toBe(2)
  })

  it('should validate query parameters', async () => {
    const apiSchema = {
      searchUsers: defineGet('/users/search', {
        input: {
          query: {
            q: z.string(),
          },
        },
        response: z.object({ results: z.array(z.string()) }),
      }),
    }

    apiSchema.searchUsers.defineMock(() => ({ results: ['user1', 'user2'] }))

    const app = createMockServer(apiSchema)

    // Request without required query parameter should fail
    const res = await app.request('/users/search')
    expect(res.status).toBe(400)
  })

  it('should handle GET request with path prefix option', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
        options: { prefix: '/api/v1' },
      }),
    }

    apiSchema.getUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      name: 'User',
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/api/v1/users/123')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('123')
  })

  it('should handle GET request with base path option', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }

    apiSchema.getUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      name: 'User',
    }))

    const app = createMockServer(apiSchema, { base: '/api' })

    const res = await app.request('/api/users/123')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('123')
  })

  it('should return 500 when no mock defined and zodToMock not provided', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123')
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('No mock defined')
  })

  it('should handle GET request with string response', async () => {
    const apiSchema = {
      getText: defineGet('/text', {
        response: z.string(),
      }),
    }

    apiSchema.getText.defineMock(() => 'Hello, World!')

    const app = createMockServer(apiSchema)

    const res = await app.request('/text')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello, World!')
  })

  it('should handle GET request with void response', async () => {
    const apiSchema = {
      ping: defineGet('/ping', {
        response: z.void(),
      }),
    }

    apiSchema.ping.defineMock(() => undefined)

    const app = createMockServer(apiSchema)

    const res = await app.request('/ping')
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('should handle GET request with nested path parameters', async () => {
    const apiSchema = {
      getUserPost: defineGet('/users/:userId/posts/:postId', {
        response: z.object({
          userId: z.string(),
          postId: z.string(),
          title: z.string(),
        }),
      }),
    }

    apiSchema.getUserPost.defineMock((ctx) => ({
      userId: ctx.inputs.param.userId,
      postId: ctx.inputs.param.postId,
      title: 'Post Title',
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/user123/posts/post456')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.userId).toBe('user123')
    expect(data.postId).toBe('post456')
  })

  it('should handle GET request with async mock function', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }

    apiSchema.getUser.defineMock(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return {
        id: ctx.inputs.param.id,
        name: 'Async User',
      }
    })

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('Async User')
  })

  it('should provide hono context to mock function', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), customHeader: z.string() }),
      }),
    }

    apiSchema.getUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      customHeader: ctx.honoContext.req.header('X-Custom') || 'none',
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123', {
      headers: { 'X-Custom': 'test-value' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customHeader).toBe('test-value')
  })

  it('should handle custom middleware', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }

    apiSchema.getUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      name: 'User',
    }))

    let middlewareCalled = false

    const app = createMockServer(apiSchema, {
      addMiddleware: (app) => {
        app.use('*', async (_c, next) => {
          middlewareCalled = true
          await next()
        })
      },
    })

    await app.request('/users/123')
    expect(middlewareCalled).toBe(true)
  })

  it('should handle array response', async () => {
    const apiSchema = {
      listUsers: defineGet('/users', {
        response: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    }

    apiSchema.listUsers.defineMock(() => [
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
    ])

    const app = createMockServer(apiSchema)

    const res = await app.request('/users')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(2)
  })

  it('should handle string response with non-string mock value', async () => {
    const apiSchema = {
      getText: defineGet('/text', {
        response: z.string(),
      }),
    }

    apiSchema.getText.defineMock(() => ({ not: 'a string' }) as any)

    const app = createMockServer(apiSchema)

    const res = await app.request('/text')
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.message).toContain('string is expected')
  })
})

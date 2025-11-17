import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { defineGet } from '../../endpoint/define-endpoint'
import { ApiError, NetworkError } from '../../utils/errors'
import { createApiClient } from '../api-client'

describe('GET endpoints', () => {
  it('should perform a GET request and return typed response', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        input: {
          query: {
            page: z.string(),
            limit: z.string().optional(),
          },
        },
        response: z.object({
          id: z.string(),
          name: z.string(),
        }),
      }),
    }

    const app = new Hono().get(
      '/users/:id',
      zValidator(
        'query',
        z.object({
          page: z.string(),
          limit: z.string().optional(),
        }),
      ),
      (c) => {
        const { id } = c.req.param()
        return c.json({ id, name: 'John Doe' })
      },
    )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.api.users.id('123').get({ query: { page: '1' } })
    expect(res).toHaveProperty('data')
    if (res.data) {
      expect(res.data).toEqual({ id: '123', name: 'John Doe' })
    }
  })

  it('should handle GET request without parameters', async () => {
    const apiSchema = {
      listUsers: defineGet('/users', {
        response: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    }
    const app = new Hono().get('/users', (c) =>
      c.json([
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
      ]),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.api.users.get()
    expect(res).toHaveProperty('data')
    if (res.data) {
      expect(res.data).toHaveLength(2)
    }
  })

  it('should handle optional query parameters', async () => {
    const apiSchema = {
      searchUsers: defineGet('/users/search', {
        input: {
          query: {
            q: z.string(),
            page: z.string().optional(),
            limit: z.string().optional(),
          },
        },
        response: z.object({
          users: z.array(z.object({ id: z.string(), name: z.string() })),
          total: z.number(),
        }),
      }),
    }
    const app = new Hono().get(
      '/users/search',
      zValidator(
        'query',
        z.object({
          q: z.string(),
          page: z.string().optional(),
          limit: z.string().optional(),
        }),
      ),
      (c) => c.json({ users: [{ id: '1', name: 'John Doe' }], total: 1 }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.api.users.search.get({ query: { q: 'john' } })
    expect(res).toHaveProperty('data')
    if (res.data) {
      expect(res.data.users).toHaveLength(1)
    }
  })

  it('should support custom headers per request', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const app = new Hono().get('/users/:id', (c) =>
      c.json({ id: c.req.param('id'), name: 'John Doe' }),
    )
    const fetchSpy = vi.spyOn(app, 'fetch')
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    await client.api.users.id('123').get({
      headers: { Authorization: 'Bearer token123', 'X-Custom': 'value' },
    })
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('Authorization')).toBe('Bearer token123')
    expect(request.headers.get('X-Custom')).toBe('value')
  })

  it('should support AbortSignal for request cancellation', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const mockFetch = vi.fn().mockImplementation((input: Request) => {
      if (input.signal?.aborted) {
        return Promise.reject(new DOMException('Request aborted', 'AbortError'))
      }
      return new Promise((resolve) => setTimeout(resolve, 1000))
    })
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: mockFetch,
    })
    const controller = new AbortController()
    controller.abort()
    const res = await client.api.users
      .id('123')
      .get({ signal: controller.signal })
    expect(res).toHaveProperty('error')
    if (res.error) {
      expect(res.error).toBeInstanceOf(NetworkError)
    }
  })

  it('should handle complex query parameter scenarios', async () => {
    const apiSchema = {
      searchComplex: defineGet('/search', {
        input: {
          query: {
            q: z.string(),
            filters: z.array(z.string()).optional(),
            page: z.coerce.number().optional(),
            nested: z
              .object({
                category: z.string(),
                subcategory: z.string().optional(),
              })
              .optional(),
          },
        },
        response: z.object({ results: z.array(z.string()), count: z.number() }),
      }),
    }
    const app = new Hono().get(
      '/search',
      zValidator(
        'query',
        z.object({
          q: z.string(),
          filters: z.array(z.string()).optional(),
          page: z.coerce.number().optional(),
          nested: z
            .object({
              category: z.string(),
              subcategory: z.string().optional(),
            })
            .optional(),
        }),
      ),
      (c) => c.json({ results: ['item1', 'item2'], count: 2 }),
    )
    const fetchSpy = vi.spyOn(app, 'fetch')
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    await client.api.search.get({
      query: {
        q: 'test query',
        filters: ['filter1', 'filter2'],
        page: 2,
        nested: { category: 'electronics', subcategory: 'phones' },
      },
    })
    const request = fetchSpy.mock.calls[0][0] as Request
    const url = new URL(request.url)
    expect(url.searchParams.get('q')).toBe('test query')
    expect(url.searchParams.getAll('filters')).toEqual(['filter1', 'filter2'])
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('nested[category]')).toBe('electronics')
    expect(url.searchParams.get('nested[subcategory]')).toBe('phones')
  })

  it('should perform nested path parameter resolution', async () => {
    const apiSchema = {
      getUserPost: defineGet('/users/:userId/posts/:postId', {
        response: z.object({
          id: z.string(),
          title: z.string(),
          userId: z.string(),
        }),
      }),
    }
    const app = new Hono().get('/users/:userId/posts/:postId', (c) => {
      const { userId, postId } = c.req.param()
      return c.json({ id: postId, title: 'My Post', userId })
    })
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.api.users.userId('456').posts.postId('123').get()
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.id).toBe('123')
  })

  it('should handle deep nested resources', async () => {
    const apiSchema = {
      getCommentReply: defineGet(
        '/users/:userId/posts/:postId/comments/:commentId/replies/:replyId',
        {
          response: z.object({
            id: z.string(),
            content: z.string(),
            commentId: z.string(),
          }),
        },
      ),
    }
    const app = new Hono().get(
      '/users/:userId/posts/:postId/comments/:commentId/replies/:replyId',
      (c) => {
        const { replyId, commentId } = c.req.param()
        return c.json({ id: replyId, content: 'Reply content', commentId })
      },
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.api.users
      .userId('123')
      .posts.postId('456')
      .comments.commentId('789')
      .replies.replyId('101')
      .get()
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.id).toBe('101')
  })

  it('should handle malformed JSON responses gracefully', async () => {
    const apiSchema = {
      getBrokenJson: defineGet('/broken', {
        response: z.object({ data: z.string() }),
      }),
    }
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{ invalid json }', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: mockFetch,
    })
    const res = await client.api.broken.get()
    expect(res).toHaveProperty('error')
    if (res.error) {
      expect(res.error).toBeInstanceOf(ApiError)
    }
  })

  it('should handle API with different content types', async () => {
    const apiSchema = {
      getJson: defineGet('/api/json', {
        response: z.object({ type: z.string() }),
      }),
      getText: defineGet('/api/text', { response: z.string() }),
    }
    const app = new Hono()
      .get('/api/text', (c) => c.text('plain text response'))
      .get('/api/json', (c) => c.json({ type: 'json' }))
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const jsonRes = await client.api.api.json.get()
    const textRes = await client.api.api.text.get()
    if (jsonRes.data) expect(jsonRes.data).toEqual({ type: 'json' })
    if (textRes.data) expect(textRes.data).toBe('plain text response')
  })

  it('should handle error responses with different status codes', async () => {
    const apiSchema = {
      testEndpoint: defineGet('/test', {
        response: z.object({ success: z.boolean() }),
      }),
    }
    const testCases = [400, 401, 403, 500]
    for (const status of testCases) {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: `Error ${status}` }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: mockFetch,
      })
      const res = await client.api.test.get()
      expect(res).toHaveProperty('error')
      if (res.error) expect((res.error as ApiError).status).toBe(status)
    }
  })

  it('should handle 404 errors', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: mockFetch,
    })
    const res = await client.api.users.id('999').get()
    expect(res).toHaveProperty('error')
    if (res.error) expect((res.error as ApiError).status).toBe(404)
  })

  it('should handle network errors', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: mockFetch,
    })
    const res = await client.api.users.id('123').get()
    expect(res).toHaveProperty('error')
    if (res.error) expect(res.error).toBeInstanceOf(NetworkError)
  })

  it('should support request interceptors', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const app = new Hono().get('/users/:id', (c) =>
      c.json({ id: c.req.param('id'), name: 'John Doe' }),
    )
    const fetchSpy = vi.spyOn(app, 'fetch')
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const requestInterceptor = vi.fn((_context, options) => ({
      ...options,
      headers: { ...options.headers, 'X-Custom-Header': 'test-value' },
    }))
    client.interceptors.request.use(requestInterceptor)
    await client.api.users.id('123').get()
    const request = fetchSpy.mock.calls[0][0] as Request

    expect(requestInterceptor).toHaveBeenCalled()
    expect(request.headers.get('X-Custom-Header')).toBe('test-value')
  })

  it('should support response interceptors', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const app = new Hono().get('/users/:id', (c) =>
      c.json({ id: c.req.param('id'), name: 'John Doe' }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const responseInterceptor = vi.fn((_context, response) => response)
    client.interceptors.response.use(responseInterceptor)
    await client.api.users.id('123').get()
    expect(responseInterceptor).toHaveBeenCalled()
  })

  it('should support local request/response transformers', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const app = new Hono().get('/users/:id', (c) =>
      c.json({ id: c.req.param('id'), name: 'John Doe' }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const localRequestTransformer = vi.fn((_context, options) => ({
      ...options,
      headers: { ...options.headers, 'X-Local-Header': 'local-value' },
    }))
    const localResponseTransformer = vi.fn((_context, response) => response)
    await client.api.users.id('123').get({
      transformRequest: localRequestTransformer,
      transformResponse: localResponseTransformer,
    })
    expect(localRequestTransformer).toHaveBeenCalled()
    expect(localResponseTransformer).toHaveBeenCalled()
  })

  it('should handle interceptor chaining correctly', async () => {
    const apiSchema = {
      getUser: defineGet('/users/:id', {
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }
    const app = new Hono().get('/users/:id', (c) =>
      c.json({ id: c.req.param('id'), name: 'John Doe' }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const order: string[] = []
    client.interceptors.request.use((_c, o) => {
      order.push('request-1')
      return { ...o, headers: { ...o.headers, 'X-First': 'first' } }
    })
    client.interceptors.request.use((_c, o) => {
      order.push('request-2')
      return { ...o, headers: { ...o.headers, 'X-Second': 'second' } }
    })
    client.interceptors.response.use((_c, r) => {
      order.push('response-1')
      return r
    })
    client.interceptors.response.use((_c, r) => {
      order.push('response-2')
      return r
    })
    await client.api.users.id('123').get()
    expect(order).toEqual([
      'request-1',
      'request-2',
      'response-1',
      'response-2',
    ])
  })
})

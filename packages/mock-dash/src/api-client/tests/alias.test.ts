import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import {
  defineGet,
  definePost,
  definePut,
} from '../../endpoint/define-endpoint'
import { createApiClient } from '../api-client'

describe('Alias functionality in createApiClient', () => {
  describe('Path aliases', () => {
    it('should support basic path alias replacement', async () => {
      const apiSchema = {
        getUser: defineGet('/{api}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const app = new Hono().get('/api/v1/users/:id', (c) => {
        const { id } = c.req.param()
        return c.json({ id, name: 'John Doe' })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{api}'].users.id('123').get()
      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data.id).toBe('123')
        expect(res.data.name).toBe('John Doe')
      }
    })

    it('should support multiple path aliases in the same endpoint', async () => {
      const apiSchema = {
        getResource: defineGet('/{service}/{version}/resources/:id', {
          response: z.object({
            id: z.string(),
            service: z.string(),
            version: z.string(),
          }),
          options: {
            alias: {
              service: '/api',
              version: 'v2',
            },
          },
        }),
      }

      const app = new Hono().get('/api/v2/resources/:id', (c) => {
        const { id } = c.req.param()
        return c.json({ id, service: 'api', version: 'v2' })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{service}']['{version}'].resources
        .id('456')
        .get()
      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data.id).toBe('456')
        expect(res.data.service).toBe('api')
        expect(res.data.version).toBe('v2')
      }
    })

    it('should support path aliases with complex nested paths', async () => {
      const apiSchema = {
        getUserPosts: defineGet('/{api}/users/:userId/posts/:postId', {
          response: z.object({
            userId: z.string(),
            postId: z.string(),
            title: z.string(),
          }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const app = new Hono().get('/api/v1/users/:userId/posts/:postId', (c) => {
        const { userId, postId } = c.req.param()
        return c.json({ userId, postId, title: 'Sample Post' })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{api}'].users
        .userId('123')
        .posts.postId('456')
        .get()
      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data.userId).toBe('123')
        expect(res.data.postId).toBe('456')
        expect(res.data.title).toBe('Sample Post')
      }
    })

    it('should support path aliases with query parameters', async () => {
      const apiSchema = {
        searchUsers: defineGet('/{api}/users/search', {
          input: {
            query: {
              q: z.string(),
              limit: z.string().optional(),
            },
          },
          response: z.array(z.object({ id: z.string(), name: z.string() })),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const app = new Hono().get('/api/v1/users/search', (c) =>
        c.json([{ id: '1', name: 'John Doe' }]),
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{api}'].users.search.get({
        query: { q: 'john', limit: '10' },
      })
      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data).toHaveLength(1)
        expect(res.data[0].name).toBe('John Doe')
      }
    })

    it('should support path aliases with POST requests and JSON body', async () => {
      const apiSchema = {
        createUser: definePost('/{api}/users', {
          input: {
            json: z.object({ name: z.string(), email: z.string() }),
          },
          response: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
          }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const app = new Hono().post('/api/v1/users', async (c) => {
        const body = await c.req.json()
        return c.json({
          id: 'new-id',
          name: body.name,
          email: body.email,
        })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{api}'].users.post({
        json: { name: 'Jane Doe', email: 'jane@example.com' },
      })

      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data.id).toBe('new-id')
        expect(res.data.name).toBe('Jane Doe')
        expect(res.data.email).toBe('jane@example.com')
      }
    })

    it('should handle root path aliases correctly', async () => {
      const apiSchema = {
        getHealth: defineGet('/{root}/health', {
          response: z.object({ status: z.string() }),
          options: {
            alias: { root: '/' },
          },
        }),
      }

      const app = new Hono().get('/health', (c) => c.json({ status: 'ok' }))

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{root}'].health.get()
      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data.status).toBe('ok')
      }
    })

    it('should normalize duplicate slashes in alias values', async () => {
      const apiSchema = {
        getUser: defineGet('/{api}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: {
            alias: { api: '///api///v1//' },
          },
        }),
      }

      const app = new Hono().get('/api/v1/users/:id', (c) => {
        const { id } = c.req.param()
        return c.json({ id, name: 'John Doe' })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res = await client['{api}'].users.id('123').get()
      expect(res).toHaveProperty('data')
      if (res.data) {
        expect(res.data.id).toBe('123')
        expect(res.data.name).toBe('John Doe')
      }
    })

    it('should work with different HTTP methods and path aliases', async () => {
      const apiSchema = {
        getUser: defineGet('/{api}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: { alias: { api: '/api/v1' } },
        }),
        updateUser: definePut('/{api}/users/:id', {
          input: {
            json: z.object({ name: z.string() }),
          },
          response: z.object({
            id: z.string(),
            name: z.string(),
            updated: z.boolean(),
          }),
          options: { alias: { api: '/api/v1' } },
        }),
      }

      const app = new Hono()
        .get('/api/v1/users/:id', (c) => {
          const { id } = c.req.param()
          return c.json({ id, name: 'Original Name' })
        })
        .put('/api/v1/users/:id', async (c) => {
          const { id } = c.req.param()
          const body = await c.req.json()
          return c.json({ id, name: body.name, updated: true })
        })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      // Test GET with alias
      const getRes = await client['{api}'].users.id('123').get()
      expect(getRes).toHaveProperty('data')
      if (getRes.data) expect(getRes.data.name).toBe('Original Name')

      // Test PUT with alias
      const putRes = await client['{api}'].users.id('123').put({
        json: { name: 'Updated Name' },
      })
      expect(putRes).toHaveProperty('data')
      if (putRes.data) {
        expect(putRes.data.name).toBe('Updated Name')
        expect(putRes.data.updated).toBe(true)
      }
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle endpoints without aliases normally', async () => {
      const apiSchema = {
        getUserWithoutAlias: defineGet('/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
        }),
        getUserWithAlias: defineGet('/{api}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const app = new Hono()
        .get('/users/:id', (c) => {
          const { id } = c.req.param()
          return c.json({ id, name: 'No Alias User' })
        })
        .get('/api/v1/users/:id', (c) => {
          const { id } = c.req.param()
          return c.json({ id, name: 'Alias User' })
        })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      // Test endpoint without alias
      const res1 = await client.users.id('123').get()
      expect(res1).toHaveProperty('data')
      if (res1.data) expect(res1.data.name).toBe('No Alias User')
    })

    it('should handle mixed alias configurations in different endpoints', async () => {
      const apiSchema = {
        v1Endpoint: defineGet('/{api}/v1/users', {
          response: z.array(z.object({ id: z.string(), name: z.string() })),
          options: {
            alias: { api: '/api' },
          },
        }),
        v2Endpoint: defineGet('/{service}/v2/users', {
          response: z.array(z.object({ id: z.string(), name: z.string() })),
          options: {
            alias: { service: '/api' },
          },
        }),
      }

      const app = new Hono()
        .get('/api/v1/users', (c) => c.json([{ id: '1', name: 'V1 User' }]))
        .get('/api/v2/users', (c) => c.json([{ id: '2', name: 'V2 User' }]))

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const res1 = await client['{api}'].v1.users.get()
      const res2 = await client['{service}'].v2.users.get()

      expect(res1).toHaveProperty('data')
      expect(res2).toHaveProperty('data')

      if (res1.data) expect(res1.data[0].name).toBe('V1 User')
      if (res2.data) expect(res2.data[0].name).toBe('V2 User')
    })
  })
})

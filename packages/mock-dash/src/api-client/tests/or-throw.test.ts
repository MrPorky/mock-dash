import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'
import {
  defineDelete,
  defineGet,
  definePatch,
  definePost,
  definePut,
} from '../../endpoint/define-endpoint'
import { ApiError, NetworkError, ValidationError } from '../../utils/errors'
import { createApiClient } from '../api-client'

describe('Unsafe API calls', () => {
  describe('GET endpoints', () => {
    it('should return data directly on successful GET request', async () => {
      const apiSchema = {
        getUser: defineGet('/users/:id', {
          response: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
          }),
        }),
      }

      const app = new Hono().get('/users/:id', (c) => {
        const { id } = c.req.param()
        return c.json({
          id,
          name: 'John Doe',
          email: 'john@example.com',
        })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const userData = await client.users.id('123').get.orThrow()

      // Should return data directly, not wrapped in result object
      expect(userData).toEqual({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
      })
      expect(userData.id).toBe('123')
      expect(userData.name).toBe('John Doe')
    })

    it('should throw ApiError on HTTP error status', async () => {
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

      await expect(client.users.id('999').get.orThrow()).rejects.toThrow(
        ApiError,
      )

      try {
        await client.users.id('999').get.orThrow()
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).message).toContain('404')
      }
    })

    it('should throw ValidationError on response validation failure', async () => {
      const apiSchema = {
        getUser: defineGet('/users/:id', {
          response: z.object({
            id: z.string(),
            name: z.string(),
            age: z.number(),
          }),
        }),
      }

      const app = new Hono().get('/users/:id', (c) => {
        return c.json({
          id: c.req.param('id'),
          name: 'John Doe',
          // Missing required 'age' field
        })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      await expect(client.users.id('123').get.orThrow()).rejects.toThrow(
        ValidationError,
      )

      try {
        await client.users.id('123').get.orThrow()
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).validationType).toBe('response')
      }
    })

    it('should throw NetworkError on network failure', async () => {
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

      await expect(client.users.id('123').get.orThrow()).rejects.toThrow(
        NetworkError,
      )
    })
  })

  describe('POST endpoints', () => {
    it('should return data directly on successful POST request', async () => {
      const apiSchema = {
        createUser: definePost('/users', {
          input: {
            json: z.object({ name: z.string(), email: z.string().email() }),
          },
          response: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            createdAt: z.string(),
          }),
        }),
      }

      const app = new Hono().post(
        '/users',
        zValidator(
          'json',
          z.object({ name: z.string(), email: z.string().email() }),
        ),
        (c) =>
          c.json({
            id: 'new-user-id',
            name: 'Jane Doe',
            email: 'jane@example.com',
            createdAt: '2023-01-01T00:00:00Z',
          }),
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const newUser = await client.users.post.orThrow({
        json: { name: 'Jane Doe', email: 'jane@example.com' },
      })

      expect(newUser).toEqual({
        id: 'new-user-id',
        name: 'Jane Doe',
        email: 'jane@example.com',
        createdAt: '2023-01-01T00:00:00Z',
      })
    })

    it('should throw error on POST validation failure', async () => {
      const apiSchema = {
        createUser: definePost('/users', {
          input: {
            json: z.object({ name: z.string(), email: z.string().email() }),
          },
          response: z.object({ id: z.string(), name: z.string() }),
        }),
      }

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid email' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: mockFetch,
      })

      await expect(
        client.users.post.orThrow({
          json: { name: 'John', email: 'john@example.com' },
        }),
      ).rejects.toThrow(ApiError)
    })
  })

  describe('PUT endpoints', () => {
    it('should return data directly on successful PUT request', async () => {
      const apiSchema = {
        updateUser: definePut('/users/:id', {
          input: {
            json: z.object({ name: z.string(), email: z.string().email() }),
          },
          response: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            updatedAt: z.string(),
          }),
        }),
      }

      const app = new Hono().put(
        '/users/:id',
        zValidator(
          'json',
          z.object({ name: z.string(), email: z.string().email() }),
        ),
        (c) => {
          const { id } = c.req.param()
          return c.json({
            id,
            name: 'Updated Jane',
            email: 'updated.jane@example.com',
            updatedAt: '2023-01-01T12:00:00Z',
          })
        },
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const updatedUser = await client.users.id('123').put.orThrow({
        json: { name: 'Updated Jane', email: 'updated.jane@example.com' },
      })

      expect(updatedUser.name).toBe('Updated Jane')
      expect(updatedUser.updatedAt).toContain('2023-01-01')
    })
  })

  describe('PATCH endpoints', () => {
    it('should return data directly on successful PATCH request', async () => {
      const apiSchema = {
        patchUser: definePatch('/users/:id', {
          input: {
            json: z.object({
              name: z.string().optional(),
              email: z.string().email().optional(),
            }),
          },
          response: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            updatedAt: z.string(),
          }),
        }),
      }

      const app = new Hono().patch(
        '/users/:id',
        zValidator(
          'json',
          z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
          }),
        ),
        (c) => {
          const { id } = c.req.param()
          return c.json({
            id,
            name: 'Patched Name',
            email: 'existing@example.com',
            updatedAt: '2023-01-01T12:00:00Z',
          })
        },
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const patchedUser = await client.users.id('123').patch.orThrow({
        json: { name: 'Patched Name' },
      })

      expect(patchedUser.name).toBe('Patched Name')
      expect(patchedUser.id).toBe('123')
    })
  })

  describe('DELETE endpoints', () => {
    it('should return data directly on successful DELETE request with response', async () => {
      const apiSchema = {
        deleteUserWithConfirmation: defineDelete('/users/:id/confirm', {
          response: z.object({ deleted: z.boolean(), deletedAt: z.string() }),
        }),
      }

      const app = new Hono().delete('/users/:id/confirm', (c) =>
        c.json({ deleted: true, deletedAt: '2023-01-01T12:00:00Z' }),
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const deleteResult = await client.users.id('123').confirm.delete.orThrow()

      expect(deleteResult.deleted).toBe(true)
      expect(deleteResult.deletedAt).toBe('2023-01-01T12:00:00Z')
    })

    it('should handle DELETE with void response', async () => {
      const apiSchema = {
        deleteUser: defineDelete('/users/:id', { response: z.void() }),
      }

      const app = new Hono().delete('/users/:id', (c) => c.body(null, 204))

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const result = await client.users.id('123').delete.orThrow()

      // void response should return undefined
      expect(result).toBeUndefined()
    })
  })

  describe('Error handling comparison', () => {
    it('should demonstrate difference between safe and unsafe calls', async () => {
      const apiSchema = {
        getUser: defineGet('/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
        }),
      }

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: mockFetch,
      })

      // Safe call returns error in result object
      const safeResult = await client.users.id('999').get()
      expect(safeResult).toHaveProperty('error')
      expect(safeResult.error).toBeInstanceOf(ApiError)

      // Unsafe call throws the error
      await expect(client.users.id('999').get.orThrow()).rejects.toThrow(
        ApiError,
      )
    })
  })

  describe('Type safety and usage', () => {
    it('should provide proper TypeScript types for unsafe calls', async () => {
      const apiSchema = {
        getUser: defineGet('/users/:id', {
          response: z.object({
            id: z.string(),
            name: z.string(),
            isActive: z.boolean(),
          }),
        }),
      }

      const app = new Hono().get('/users/:id', (c) => {
        return c.json({
          id: c.req.param('id'),
          name: 'John Doe',
          isActive: true,
        })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      // TypeScript should infer the correct type without the wrapper
      const user = await client.users.id('123').get.orThrow()

      // These should be directly accessible without checking for error
      expect(user.id).toBe('123')
      expect(user.name).toBe('John Doe')
      expect(user.isActive).toBe(true)

      // Verify TypeScript types are what we expect
      const _typeCheck: {
        id: string
        name: string
        isActive: boolean
      } = user

      expect(_typeCheck).toBeDefined()
    })
  })

  describe('Complex scenarios', () => {
    it('should work with query parameters', async () => {
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
            page: z.number(),
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
        (c) =>
          c.json({
            users: [
              { id: '1', name: 'John Doe' },
              { id: '2', name: 'Jane Smith' },
            ],
            total: 2,
            page: 1,
          }),
      )

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const searchResult = await client.users.search.get.orThrow({
        query: { q: 'john', page: '1', limit: '10' },
      })

      expect(searchResult.users).toHaveLength(2)
      expect(searchResult.total).toBe(2)
      expect(searchResult.page).toBe(1)
    })

    it('should work with nested path parameters', async () => {
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
        return c.json({
          id: postId,
          title: 'Sample Post',
          userId,
        })
      })

      const client = createApiClient({
        apiSchema,
        baseURL: 'http://localhost',
        fetch: app.fetch,
      })

      const post = await client.users
        .userId('456')
        .posts.postId('123')
        .get.orThrow()

      expect(post.id).toBe('123')
      expect(post.userId).toBe('456')
      expect(post.title).toBe('Sample Post')
    })

    it('should work with interceptors', async () => {
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

      // Add request interceptor
      client.interceptors.request.use((_context, options) => ({
        ...options,
        headers: { ...options.headers, 'X-Custom-Header': 'test-value' },
      }))

      const userData = await client.users.id('123').get.orThrow()

      expect(userData.id).toBe('123')
      expect(userData.name).toBe('John Doe')
    })
  })
})

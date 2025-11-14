import { describe, expect, it } from 'vitest'
import z from 'zod'
import {
  defineDelete,
  defineGet,
  definePost,
  definePut,
} from '../../endpoint/define-endpoint'
import { createMockServer } from '../create-mock-server'

describe('Alias functionality in createMockServer', () => {
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

      apiSchema.getUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'John Doe',
      }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users/123')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('123')
      expect(data.name).toBe('John Doe')
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

      apiSchema.getResource.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        service: 'api',
        version: 'v2',
      }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v2/resources/456')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('456')
      expect(data.service).toBe('api')
      expect(data.version).toBe('v2')
    })

    it('should support undefined aliases (empty alias object)', async () => {
      const apiSchema = {
        getResource: defineGet('/{service}/{version}/resources/:id', {
          response: z.object({
            id: z.string(),
            service: z.string(),
            version: z.string(),
          }),
          options: {
            alias: {},
          },
        }),
      }

      apiSchema.getResource.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        service: 'api',
        version: 'v2',
      }))

      const { app } = createMockServer(apiSchema)

      // When aliases are empty, placeholders should be removed
      const res = await app.request('/resources/456')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('456')
      expect(data.service).toBe('api')
      expect(data.version).toBe('v2')
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

      apiSchema.getUserPosts.defineMock((ctx) => ({
        userId: ctx.inputs.param.userId,
        postId: ctx.inputs.param.postId,
        title: 'Sample Post',
      }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users/123/posts/456')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.userId).toBe('123')
      expect(data.postId).toBe('456')
      expect(data.title).toBe('Sample Post')
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

      apiSchema.searchUsers.defineMock((ctx) => [
        { id: '1', name: `Found: ${ctx.inputs.query.q}` },
      ])

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users/search?q=john&limit=10')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Found: john')
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

      apiSchema.createUser.defineMock((ctx) => ({
        id: 'new-id',
        name: ctx.inputs.json.name,
        email: ctx.inputs.json.email,
      }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('new-id')
      expect(data.name).toBe('Jane Doe')
      expect(data.email).toBe('jane@example.com')
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

      apiSchema.getHealth.defineMock(() => ({ status: 'ok' }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/health')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('ok')
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

      apiSchema.getUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'John Doe',
      }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users/123')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('123')
      expect(data.name).toBe('John Doe')
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
        deleteUser: defineDelete('/{api}/users/:id', {
          response: z.object({
            id: z.string(),
            deleted: z.boolean(),
          }),
          options: { alias: { api: '/api/v1' } },
        }),
      }

      apiSchema.getUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'Original Name',
      }))

      apiSchema.updateUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: ctx.inputs.json.name,
        updated: true,
      }))

      apiSchema.deleteUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        deleted: true,
      }))

      const { app } = createMockServer(apiSchema)

      // Test GET with alias
      const getRes = await app.request('/api/v1/users/123')
      expect(getRes.status).toBe(200)
      const getData = await getRes.json()
      expect(getData.name).toBe('Original Name')

      // Test PUT with alias
      const putRes = await app.request('/api/v1/users/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      })
      expect(putRes.status).toBe(200)
      const putData = await putRes.json()
      expect(putData.name).toBe('Updated Name')
      expect(putData.updated).toBe(true)

      // Test DELETE with alias
      const deleteRes = await app.request('/api/v1/users/123', {
        method: 'DELETE',
      })
      expect(deleteRes.status).toBe(200)
      const deleteData = await deleteRes.json()
      expect(deleteData.deleted).toBe(true)
    })

    it('should work with base path and aliases combined', async () => {
      const apiSchema = {
        getUser: defineGet('/{version}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: {
            alias: { version: 'v2' },
          },
        }),
      }

      apiSchema.getUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'Base Path User',
      }))

      const { app } = createMockServer(apiSchema, { base: '/api' })

      const res = await app.request('/api/v2/users/123')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('123')
      expect(data.name).toBe('Base Path User')
    })

    it('should support aliases with form data', async () => {
      const apiSchema = {
        uploadFile: definePost('/{api}/upload', {
          input: {
            form: {
              filename: z.string(),
              content: z.string(),
            },
          },
          response: z.object({
            success: z.boolean(),
            filename: z.string(),
          }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      apiSchema.uploadFile.defineMock((ctx) => ({
        success: true,
        filename: ctx.inputs.form.filename,
      }))

      const { app } = createMockServer(apiSchema)

      const formData = new FormData()
      formData.append('filename', 'test.txt')
      formData.append('content', 'file content')

      const res = await app.request('/api/v1/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.filename).toBe('test.txt')
    })
  })

  describe('Alias with zodToMock fallback', () => {
    it('should use zodToMock when no mock is defined with aliases', async () => {
      const apiSchema = {
        getUser: defineGet('/{api}/users/:id', {
          response: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string().email(),
          }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const { app } = createMockServer(apiSchema, {
        zodToMock: (schema) => {
          if (schema instanceof z.ZodObject) {
            return {
              id: 'mock-123',
              name: 'Generated User',
              email: 'generated@example.com',
            } as z.infer<typeof schema>
          }
          return '' as any
        },
      })

      const res = await app.request('/api/v1/users/123')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        id: 'mock-123',
        name: 'Generated User',
        email: 'generated@example.com',
      })
    })

    it('should return 500 when no mock defined and no zodToMock with aliases', async () => {
      const apiSchema = {
        getUser: defineGet('/{api}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users/123')
      expect(res.status).toBe(500)
      expect(await res.text()).toContain('No mock defined')
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

      apiSchema.getUserWithoutAlias.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'No Alias User',
      }))

      apiSchema.getUserWithAlias.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'Alias User',
      }))

      const { app } = createMockServer(apiSchema)

      // Test endpoint without alias
      const res1 = await app.request('/users/123')
      expect(res1.status).toBe(200)
      const data1 = await res1.json()
      expect(data1.name).toBe('No Alias User')

      // Test endpoint with alias
      const res2 = await app.request('/api/v1/users/123')
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.name).toBe('Alias User')
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

      apiSchema.v1Endpoint.defineMock(() => [{ id: '1', name: 'V1 User' }])
      apiSchema.v2Endpoint.defineMock(() => [{ id: '2', name: 'V2 User' }])

      const { app } = createMockServer(apiSchema)

      const res1 = await app.request('/api/v1/users')
      const res2 = await app.request('/api/v2/users')

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)

      const data1 = await res1.json()
      const data2 = await res2.json()

      expect(data1[0].name).toBe('V1 User')
      expect(data2[0].name).toBe('V2 User')
    })

    it('should validate input parameters with aliases', async () => {
      const apiSchema = {
        searchUsers: defineGet('/{api}/users/search', {
          input: {
            query: {
              q: z.string().min(1), // Required, non-empty string
            },
          },
          response: z.array(z.object({ id: z.string(), name: z.string() })),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      apiSchema.searchUsers.defineMock(() => [{ id: '1', name: 'Found User' }])

      const { app } = createMockServer(apiSchema)

      // Valid request
      const validRes = await app.request('/api/v1/users/search?q=john')
      expect(validRes.status).toBe(200)

      // Invalid request - missing required query parameter
      const invalidRes = await app.request('/api/v1/users/search')
      expect(invalidRes.status).toBe(400)
    })

    it('should handle string responses with aliases', async () => {
      const apiSchema = {
        getText: defineGet('/{api}/text', {
          response: z.string(),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      apiSchema.getText.defineMock(() => 'Hello from aliased endpoint!')

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/text')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('Hello from aliased endpoint!')
    })

    it('should handle void responses with aliases', async () => {
      const apiSchema = {
        ping: definePost('/{api}/ping', {
          response: z.void(),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      apiSchema.ping.defineMock(() => undefined)

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/ping', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(res.body).toBeNull()
    })

    it('should handle void responses without aliases', async () => {
      const apiSchema = {
        ping: definePost('/{api}/ping', {
          response: z.void(),
          options: {
            alias: {},
          },
        }),
      }

      apiSchema.ping.defineMock(() => undefined)

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/ping', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(res.body).toBeNull()
    })

    it('should handle base path with aliases', async () => {
      const apiSchema = {
        ping: definePost('/{api}/ping', {
          response: z.void(),
          options: {
            alias: {},
          },
        }),
      }

      apiSchema.ping.defineMock(() => undefined)

      const { app } = createMockServer(apiSchema, {
        base: '/api',
      })

      const res = await app.request('/api/ping', { method: 'POST' })
      expect(res.status).toBe(200)
      expect(res.body).toBeNull()
    })

    it('should handle middleware with aliased endpoints', async () => {
      const apiSchema = {
        getUser: defineGet('/{api}/users/:id', {
          response: z.object({ id: z.string(), name: z.string() }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      apiSchema.getUser.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'User',
      }))

      let middlewareCalled = false
      let middlewarePath = ''

      const { app } = createMockServer(apiSchema, {
        addMiddleware: (app) => {
          app.use('*', async (c, next) => {
            middlewareCalled = true
            middlewarePath = c.req.path
            await next()
          })
        },
      })

      await app.request('/api/v1/users/123')
      expect(middlewareCalled).toBe(true)
      expect(middlewarePath).toBe('/api/v1/users/123')
    })

    it('should preserve parameter types when using aliases', async () => {
      const apiSchema = {
        getUserById: defineGet('/{api}/users/:id', {
          input: {
            param: z.object({
              id: z.string(),
            }),
          },
          response: z.object({
            id: z.string(),
            name: z.string(),
            paramType: z.string(),
          }),
          options: {
            alias: { api: '/api/v1' },
          },
        }),
      }

      apiSchema.getUserById.defineMock((ctx) => ({
        id: ctx.inputs.param.id,
        name: 'Test User',
        paramType: typeof ctx.inputs.param.id,
      }))

      const { app } = createMockServer(apiSchema)

      const res = await app.request('/api/v1/users/123')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('123')
      expect(data.paramType).toBe('string')
    })
  })
})

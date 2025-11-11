import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineDelete } from '../../endpoint/define-endpoint'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - DELETE endpoints', () => {
  it('should handle DELETE request with path parameter', async () => {
    const apiSchema = {
      deleteUser: defineDelete('/users/:id', {
        response: z.object({
          id: z.string(),
          deleted: z.boolean(),
        }),
      }),
    }

    apiSchema.deleteUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      deleted: true,
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('123')
    expect(data.deleted).toBe(true)
  })

  it('should handle DELETE with nested path parameters', async () => {
    const apiSchema = {
      deleteComment: defineDelete('/posts/:postId/comments/:commentId', {
        response: z.object({
          postId: z.string(),
          commentId: z.string(),
          success: z.boolean(),
        }),
      }),
    }

    apiSchema.deleteComment.defineMock((ctx) => ({
      postId: ctx.inputs.param.postId,
      commentId: ctx.inputs.param.commentId,
      success: true,
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/posts/post1/comments/comment2', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.postId).toBe('post1')
    expect(data.commentId).toBe('comment2')
  })

  it('should handle DELETE with query parameters', async () => {
    const apiSchema = {
      deleteUser: defineDelete('/users/:id', {
        input: {
          query: {
            soft: z.string().optional(),
            reason: z.string().optional(),
          },
        },
        response: z.object({
          id: z.string(),
          softDelete: z.boolean(),
          reason: z.string(),
        }),
      }),
    }

    apiSchema.deleteUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      softDelete: ctx.inputs.query.soft === 'true',
      reason: ctx.inputs.query.reason || 'no reason provided',
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123?soft=true&reason=testing', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.softDelete).toBe(true)
    expect(data.reason).toBe('testing')
  })

  it('should handle DELETE without input', async () => {
    const apiSchema = {
      clearCache: defineDelete('/cache', {
        response: z.object({ cleared: z.boolean() }),
      }),
    }

    apiSchema.clearCache.defineMock(() => ({ cleared: true }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/cache', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cleared).toBe(true)
  })

  it('should handle DELETE with void response', async () => {
    const apiSchema = {
      deleteUser: defineDelete('/users/:id', {
        response: z.void(),
      }),
    }

    apiSchema.deleteUser.defineMock(() => undefined)

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('should return 500 when no mock defined and zodToMock not provided', async () => {
    const apiSchema = {
      deleteUser: defineDelete('/users/:id', {
        response: z.object({ deleted: z.boolean() }),
      }),
    }

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123', { method: 'DELETE' })
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('No mock defined')
  })

  it('should validate query parameters for DELETE', async () => {
    const apiSchema = {
      deleteUser: defineDelete('/users/:id', {
        input: {
          query: {
            confirmToken: z.string(),
          },
        },
        response: z.object({ deleted: z.boolean() }),
      }),
    }

    apiSchema.deleteUser.defineMock(() => ({ deleted: true }))

    const app = createMockServer(apiSchema)

    // Missing required query parameter
    const res = await app.request('/users/123', { method: 'DELETE' })
    expect(res.status).toBe(400)
  })
})

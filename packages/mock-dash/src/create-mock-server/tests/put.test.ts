import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePut } from '../../endpoint/define-endpoint'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - PUT endpoints', () => {
  it('should handle PUT request with JSON body', async () => {
    const apiSchema = {
      updateUser: definePut('/users/:id', {
        input: {
          json: z.object({
            name: z.string(),
            email: z.string().email(),
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

    apiSchema.updateUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      name: ctx.inputs.json.name,
      email: ctx.inputs.json.email,
      updatedAt: new Date().toISOString(),
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name', email: 'new@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('123')
    expect(data.name).toBe('Updated Name')
    expect(data.email).toBe('new@example.com')
  })

  it('should validate PUT request body', async () => {
    const apiSchema = {
      updateUser: definePut('/users/:id', {
        input: {
          json: z.object({
            name: z.string(),
            age: z.number(),
          }),
        },
        response: z.object({ id: z.string() }),
      }),
    }

    apiSchema.updateUser.defineMock(() => ({ id: '123' }))

    const app = createMockServer(apiSchema)

    // Invalid type for age
    const res = await app.request('/users/123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'John', age: 'not-a-number' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(400)
  })

  it('should handle PUT with path parameters', async () => {
    const apiSchema = {
      updatePost: definePut('/users/:userId/posts/:postId', {
        input: {
          json: z.object({ title: z.string(), content: z.string() }),
        },
        response: z.object({
          userId: z.string(),
          postId: z.string(),
          title: z.string(),
        }),
      }),
    }

    apiSchema.updatePost.defineMock((ctx) => ({
      userId: ctx.inputs.param.userId,
      postId: ctx.inputs.param.postId,
      title: ctx.inputs.json.title,
    }))

    const app = createMockServer(apiSchema)

    const res = await app.request('/users/user1/posts/post2', {
      method: 'PUT',
      body: JSON.stringify({ title: 'New Title', content: 'New Content' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.userId).toBe('user1')
    expect(data.postId).toBe('post2')
    expect(data.title).toBe('New Title')
  })

  it('should handle PUT with void response', async () => {
    const apiSchema = {
      updateSettings: definePut('/settings', {
        input: {
          json: z.object({ theme: z.string() }),
        },
        response: z.void(),
      }),
    }

    apiSchema.updateSettings.defineMock(() => undefined)

    const app = createMockServer(apiSchema)

    const res = await app.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme: 'dark' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePost } from '../../endpoint/define-endpoint'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - POST endpoints', () => {
  it('should handle POST request with JSON body', async () => {
    const apiSchema = {
      createUser: definePost('/users', {
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
          createdAt: z.string(),
        }),
      }),
    }

    apiSchema.createUser.defineMock((ctx) => ({
      id: 'new-id',
      name: ctx.inputs.json.name,
      email: ctx.inputs.json.email,
      createdAt: new Date().toISOString(),
    }))

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('new-id')
    expect(data.name).toBe('John Doe')
    expect(data.email).toBe('john@example.com')
  })

  it('should validate JSON body against schema', async () => {
    const apiSchema = {
      createUser: definePost('/users', {
        input: {
          json: z.object({
            name: z.string(),
            email: z.string().email(),
          }),
        },
        response: z.object({ id: z.string() }),
      }),
    }

    apiSchema.createUser.defineMock(() => ({ id: 'new-id' }))

    const { app } = createMockServer(apiSchema)

    // Invalid email
    const res = await app.request('/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'not-an-email' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(400)
  })

  it('should handle POST with path parameters', async () => {
    const apiSchema = {
      addComment: definePost('/posts/:postId/comments', {
        input: {
          json: z.object({ text: z.string() }),
        },
        response: z.object({
          id: z.string(),
          postId: z.string(),
          text: z.string(),
        }),
      }),
    }

    apiSchema.addComment.defineMock((ctx) => ({
      id: 'comment-123',
      postId: (ctx.inputs.param as { postId: string }).postId,
      text: ctx.inputs.json.text,
    }))

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/posts/post-456/comments', {
      method: 'POST',
      body: JSON.stringify({ text: 'Great post!' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.postId).toBe('post-456')
    expect(data.text).toBe('Great post!')
  })

  it('should handle POST with query parameters', async () => {
    const apiSchema = {
      createUser: definePost('/users', {
        input: {
          json: z.object({ name: z.string() }),
          query: { notify: z.string().optional() },
        },
        response: z.object({
          id: z.string(),
          name: z.string(),
          notified: z.boolean(),
        }),
      }),
    }

    apiSchema.createUser.defineMock((ctx) => ({
      id: 'user-123',
      name: ctx.inputs.json.name,
      notified: ctx.inputs.query.notify === 'true',
    }))

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/users?notify=true', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.notified).toBe(true)
  })

  it('should handle POST without input', async () => {
    const apiSchema = {
      trigger: definePost('/trigger', {
        response: z.object({ triggered: z.boolean() }),
      }),
    }

    apiSchema.trigger.defineMock(() => ({ triggered: true }))

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/trigger', { method: 'POST' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.triggered).toBe(true)
  })

  it('should handle POST with void response', async () => {
    const apiSchema = {
      notify: definePost('/notify', {
        input: {
          json: z.object({ message: z.string() }),
        },
        response: z.void(),
      }),
    }

    apiSchema.notify.defineMock(() => undefined)

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/notify', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })

  it('should handle async mock function for POST', async () => {
    const apiSchema = {
      createUser: definePost('/users', {
        input: {
          json: z.object({ name: z.string() }),
        },
        response: z.object({ id: z.string(), name: z.string() }),
      }),
    }

    apiSchema.createUser.defineMock(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return {
        id: 'async-id',
        name: ctx.inputs.json.name,
      }
    })

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Async User' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('async-id')
  })
})

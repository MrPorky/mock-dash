import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePost } from '../../http-endpoint/define-http-endpoint'
import { createApiClient } from '../api-client'

describe('POST endpoints', () => {
  it('should perform POST request with JSON body', async () => {
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
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: '2023-01-01T00:00:00Z',
        }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.users.post({
      json: { name: 'John Doe', email: 'john@example.com' },
    })
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.id).toBe('new-user-id')
  })

  it('should handle POST with form data', async () => {
    const apiSchema = {
      uploadAvatar: definePost('/users/:id/avatar', {
        input: {
          form: { file: z.string(), description: z.string().optional() },
        },
        response: z.object({ avatarUrl: z.string() }),
      }),
    }
    const app = new Hono().post(
      '/users/:id/avatar',
      zValidator(
        'form',
        z.object({ file: z.string(), description: z.string().optional() }),
      ),
      (c) => c.json({ avatarUrl: 'https://example.com/avatar.jpg' }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.users
      .id('123')
      .avatar.post({ form: { file: 'file-data', description: 'User avatar' } })
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.avatarUrl).toBeDefined()
  })
})

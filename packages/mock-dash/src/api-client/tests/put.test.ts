import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePut } from '../../endpoint/define-endpoint'
import { createApiClient } from '../api-client'

describe('PUT endpoints', () => {
  it('should perform PUT request to update resource', async () => {
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
          name: 'Jane Doe',
          email: 'jane@example.com',
          updatedAt: '2023-01-01T12:00:00Z',
        })
      },
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.users
      .id('123')
      .put({ json: { name: 'Jane Doe', email: 'jane@example.com' } })
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.updatedAt).toContain('2023-01-01')
  })
})

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePatch } from '../../endpoint/define-endpoint'
import { createApiClient } from '../api-client'

describe('PATCH endpoints', () => {
  it('should perform PATCH request for partial updates', async () => {
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
          name: 'Updated Name',
          email: 'john@example.com',
          updatedAt: '2023-01-01T12:00:00Z',
        })
      },
    )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    const res = await client.api.users
      .id('123')
      .patch({ json: { name: 'Updated Name' } })
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.name).toBe('Updated Name')
  })
})

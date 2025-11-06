import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineDelete } from '../../endpoint/define-endpoint'
import { createApiClient } from '../api-client'

describe('DELETE endpoints', () => {
  it('should perform DELETE request with void response', async () => {
    const apiSchema = {
      deleteUser: defineDelete('/users/:id', { response: z.void() }),
    }
    const app = new Hono().delete('/users/:id', (c) => c.body(null, 204))
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const res = await client.users.id('123').delete()
    expect(res).toHaveProperty('data')
    //@ts-expect-error res.data is void/never
    if (res.data) expect(res.data).toBeUndefined()
  })

  it('should handle DELETE with confirmation response', async () => {
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
    const res = await client.users.id('123').confirm.delete()
    expect(res).toHaveProperty('data')
    if (res.data) expect(res.data.deleted).toBe(true)
  })
})

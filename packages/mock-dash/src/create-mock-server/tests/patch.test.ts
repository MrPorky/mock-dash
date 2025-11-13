import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePatch } from '../../endpoint/define-endpoint'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - PATCH endpoints', () => {
  it('should handle PATCH request with JSON body', async () => {
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
        }),
      }),
    }

    apiSchema.patchUser.defineMock((ctx) => ({
      id: ctx.inputs.param.id,
      name: ctx.inputs.json.name || 'Default Name',
      email: ctx.inputs.json.email || 'default@example.com',
    }))

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/users/123', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Patched Name' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('123')
    expect(data.name).toBe('Patched Name')
    expect(data.email).toBe('default@example.com')
  })

  it('should handle partial updates with PATCH', async () => {
    const apiSchema = {
      patchProfile: definePatch('/profiles/:id', {
        input: {
          json: z.object({
            bio: z.string().optional(),
            website: z.string().url().optional(),
            avatar: z.string().optional(),
          }),
        },
        response: z.object({
          id: z.string(),
          updated: z.array(z.string()),
        }),
      }),
    }

    apiSchema.patchProfile.defineMock((ctx) => {
      const updated: string[] = []
      if (ctx.inputs.json.bio) updated.push('bio')
      if (ctx.inputs.json.website) updated.push('website')
      if (ctx.inputs.json.avatar) updated.push('avatar')

      return {
        id: ctx.inputs.param.id,
        updated,
      }
    })

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/profiles/123', {
      method: 'PATCH',
      body: JSON.stringify({ bio: 'New bio', website: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.updated).toContain('bio')
    expect(data.updated).toContain('website')
    expect(data.updated).not.toContain('avatar')
  })

  it('should validate PATCH request body', async () => {
    const apiSchema = {
      patchUser: definePatch('/users/:id', {
        input: {
          json: z.object({
            email: z.string().email().optional(),
          }),
        },
        response: z.object({ id: z.string() }),
      }),
    }

    apiSchema.patchUser.defineMock(() => ({ id: '123' }))

    const { app } = createMockServer(apiSchema)

    // Invalid email format
    const res = await app.request('/users/123', {
      method: 'PATCH',
      body: JSON.stringify({ email: 'not-an-email' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(400)
  })

  it('should handle PATCH with void response', async () => {
    const apiSchema = {
      patchSettings: definePatch('/settings/:id', {
        input: {
          json: z.object({ value: z.string().optional() }),
        },
        response: z.void(),
      }),
    }

    apiSchema.patchSettings.defineMock(() => undefined)

    const { app } = createMockServer(apiSchema)

    const res = await app.request('/settings/setting1', {
      method: 'PATCH',
      body: JSON.stringify({ value: 'new-value' }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })
})

import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineGet } from '../../http-endpoint/define-http-endpoint'
import { defineJSONStream } from '../../http-endpoint/stream-response'
import { createApiClient } from '../api-client'

describe('JSON Stream (NDJSON)', () => {
  it('should stream multiple JSON items and validate each', async () => {
    const apiSchema = {
      userStream: defineGet('/stream/users', {
        response: defineJSONStream(
          z.object({ id: z.string(), name: z.string() }),
        ),
      }),
    }

    const app = new Hono().get('/stream/users', (_c) =>
      stream(_c, async (stream) => {
        await stream.writeln(JSON.stringify({ id: '1', name: 'John' }))
        await stream.writeln(JSON.stringify({ id: '2', name: 'Jane' }))
      }),
    )

    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })

    const received: any[] = []
    const errors: any[] = []
    const result = await client.stream.users.get.$stream()

    expect(result).toHaveProperty('data')
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'json') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
    }
    expect(received).toHaveLength(2)
    expect(errors).toHaveLength(0)
  })

  it('should surface validation errors for malformed item and continue', async () => {
    const apiSchema = {
      numberStream: defineGet('/stream/numbers', {
        response: defineJSONStream(z.object({ value: z.number() })),
      }),
    }

    const app = new Hono().get('/stream/numbers', (_c) =>
      stream(_c, async (s) => {
        await s.writeln(JSON.stringify({ value: 'not-a-number' }))
        await s.writeln(JSON.stringify({ value: 42 }))
      }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const received: any[] = []
    const errors: any[] = []
    const result = await client.stream.numbers.get.$stream()
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'json') received.push(chunk.data)
        if (chunk.type === 'error') errors.push(chunk.error)
      }
    }
    expect(received).toEqual([{ value: 42 }])
    expect(errors).toHaveLength(1)
  })

  it('should support aborting JSON stream early', async () => {
    const apiSchema = {
      slowStream: defineGet('/stream/slow', {
        response: defineJSONStream(z.object({ seq: z.number() })),
      }),
    }

    const app = new Hono().get('/stream/slow', (_c) =>
      stream(_c, async (s) => {
        for (let seq = 1; seq <= 10; seq++) {
          await s.writeln(JSON.stringify({ seq }))
          await new Promise((r) => setTimeout(r, 5))
        }
      }),
    )
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const controller = new AbortController()
    const received: any[] = []
    const result = await client.stream.slow.get.$stream({
      signal: controller.signal,
    })
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'json') {
          received.push(chunk.data)
          if (received.length === 3) {
            controller.abort()
            break
          }
        }
      }
    }
    expect(received.length).toBe(3)
  })
})

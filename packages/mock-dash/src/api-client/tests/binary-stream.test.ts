import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { describe, expect, it } from 'vitest'
import { defineGet } from '../../endpoint/define-endpoint'
import { defineBinaryStream } from '../../endpoint/stream-response'
import { createApiClient } from '../api-client'

describe('Binary Stream', () => {
  it('should download binary data and expose stream', async () => {
    const apiSchema = {
      fileDownload: defineGet('/download/file', {
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    const app = new Hono().get('/download/file', (c) => {
      return stream(c, async (stream) => {
        await stream.write(new Uint8Array([1, 2, 3, 4]))
      })
    })
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const result = await client.download.file.get.$stream()
    expect(result).toHaveProperty('data')
    const collected: number[] = []
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'binary')
          collected.push(...Array.from(chunk.data as Uint8Array))
      }
    }
    expect(collected).toEqual([1, 2, 3, 4])
  })

  it('should respect specified content type', async () => {
    const apiSchema = {
      imageStream: defineGet('/download/image', {
        response: defineBinaryStream('image/png'),
      }),
    }
    const app = new Hono().get('/download/image', (_c) => {
      const pngBytes = new Uint8Array([137, 80, 78, 71])
      return new Response(pngBytes, {
        headers: { 'Content-Type': 'image/png' },
      })
    })
    const client = createApiClient({
      apiSchema,
      baseURL: 'http://localhost',
      fetch: app.fetch,
    })
    const result = await client.download.image.get.$stream()
    const collected: number[] = []
    if (result.data) {
      for await (const chunk of result.data) {
        if (chunk.type === 'binary')
          collected.push(...Array.from(chunk.data as Uint8Array))
      }
    }
    expect(collected.slice(0, 4)).toEqual([137, 80, 78, 71])
  })
})

import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineGet, definePost } from '../../endpoint/define-endpoint'
import { defineBinaryStream } from '../../endpoint/stream-response'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - Binary Stream endpoints', () => {
  it('should stream binary data with mock', async () => {
    const apiSchema = {
      downloadFile: defineGet('/files/:fileId/download', {
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.downloadFile.defineMock(async ({ inputs, stream }) => {
      const fileId = (inputs.param as { fileId: string }).fileId
      await stream.write(new TextEncoder().encode(`File: ${fileId}\n`))
      await stream.write(new TextEncoder().encode('Binary content here'))
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/files/123/download')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream',
    )
    const text = await response.text()
    expect(text).toContain('File: 123')
    expect(text).toContain('Binary content here')
  })

  it('should handle empty binary stream', async () => {
    const apiSchema = {
      emptyFile: defineGet('/files/empty', {
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.emptyFile.defineMock(async () => {
      // Write nothing
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/files/empty')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('')
  })

  it('should support POST with binary stream response', async () => {
    const apiSchema = {
      processData: definePost('/process', {
        input: {
          json: z.object({
            operation: z.string(),
          }),
        },
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.processData.defineMock(async ({ inputs, stream }) => {
      const { operation } = inputs.json
      await stream.write(new TextEncoder().encode(`Processing: ${operation}\n`))
      await stream.write(new TextEncoder().encode('Result data'))
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'encode' }),
    })

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('Processing: encode')
    expect(text).toContain('Result data')
  })

  it('should stream large binary data in chunks', async () => {
    const apiSchema = {
      largeFile: defineGet('/files/large', {
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.largeFile.defineMock(async ({ stream }) => {
      // Simulate chunked binary data
      for (let i = 0; i < 5; i++) {
        await stream.write(new TextEncoder().encode(`Chunk ${i}\n`))
      }
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/files/large')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('Chunk 0')
    expect(text).toContain('Chunk 4')
  })

  it('should support query parameters with binary stream', async () => {
    const apiSchema = {
      downloadWithOptions: defineGet('/download', {
        input: {
          query: {
            format: z.enum(['raw', 'compressed']),
            size: z.coerce.number(),
          },
        },
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.downloadWithOptions.defineMock(async ({ inputs, stream }) => {
      const { format, size } = inputs.query
      await stream.write(
        new TextEncoder().encode(`Format: ${format}, Size: ${size}`),
      )
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/download?format=compressed&size=1024')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('Format: compressed, Size: 1024')
  })

  it('should handle async mock initialization', async () => {
    const apiSchema = {
      asyncFile: defineGet('/files/async', {
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.asyncFile.defineMock(async ({ stream }) => {
      // Simulate async setup
      await new Promise((resolve) => setTimeout(resolve, 10))

      await stream.write(new TextEncoder().encode('Async content'))
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/files/async')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('Async content')
  })

  it('should support binary data types (Uint8Array, ArrayBuffer)', async () => {
    const apiSchema = {
      binaryData: defineGet('/binary', {
        response: defineBinaryStream('application/octet-stream'),
      }),
    }

    apiSchema.binaryData.defineMock(async ({ stream }) => {
      // Write Uint8Array
      const uint8 = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      await stream.write(uint8)

      // Write from ArrayBuffer
      const buffer = new TextEncoder().encode(' World').buffer
      await stream.write(new Uint8Array(buffer))
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/binary')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('Hello World')
  })
})

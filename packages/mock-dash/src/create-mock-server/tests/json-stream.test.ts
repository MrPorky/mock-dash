import { describe, expect, it } from 'vitest'
import z from 'zod'
import { defineGet, definePost } from '../../endpoint/define-endpoint'
import { defineJSONStream } from '../../endpoint/stream-response'
import { createMockServer } from '../create-mock-server'

describe('generateMockApi - JSON Stream endpoints', () => {
  it('should stream JSON objects with schema validation', async () => {
    const apiSchema = {
      streamUsers: defineGet('/users/stream', {
        response: defineJSONStream(
          z.object({
            id: z.number(),
            name: z.string(),
          }),
        ),
      }),
    }

    apiSchema.streamUsers.defineMock(async ({ stream }) => {
      await stream.writeln({ id: 1, name: 'Alice' })
      await stream.writeln({ id: 2, name: 'Bob' })
      await stream.writeln({ id: 3, name: 'Charlie' })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/users/stream')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/x-ndjson')

    const text = await response.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(3)

    const users = lines.map((line) => JSON.parse(line))
    expect(users[0]).toEqual({ id: 1, name: 'Alice' })
    expect(users[1]).toEqual({ id: 2, name: 'Bob' })
    expect(users[2]).toEqual({ id: 3, name: 'Charlie' })
  })

  it('should use zodToMock for default JSON stream values', async () => {
    const apiSchema = {
      streamProducts: defineGet('/products/stream', {
        response: defineJSONStream(
          z.object({
            id: z.number(),
            title: z.string(),
            price: z.number(),
          }),
        ),
      }),
    }

    const app = createMockServer(apiSchema, {
      zodToMock: (schema) => {
        if (schema instanceof z.ZodObject) {
          return {
            id: 999,
            title: 'Mock Product',
            price: 19.99,
          } as z.infer<typeof schema>
        }
        return undefined as any
      },
    })

    const response = await app.request('/products/stream')

    expect(response.status).toBe(200)
    const text = await response.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(1)

    const product = JSON.parse(lines[0])
    expect(product).toEqual({
      id: 999,
      title: 'Mock Product',
      price: 19.99,
    })
  })

  it('should handle empty JSON stream', async () => {
    const apiSchema = {
      emptyStream: defineGet('/stream/empty', {
        response: defineJSONStream(
          z.object({
            data: z.string(),
          }),
        ),
      }),
    }

    apiSchema.emptyStream.defineMock(async () => {
      // Write nothing
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/stream/empty')

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe('')
  })

  it('should stream with query parameters', async () => {
    const apiSchema = {
      streamFiltered: defineGet('/items/stream', {
        input: {
          query: {
            category: z.string(),
            limit: z.coerce.number(),
          },
        },
        response: defineJSONStream(
          z.object({
            id: z.number(),
            category: z.string(),
          }),
        ),
      }),
    }

    apiSchema.streamFiltered.defineMock(async ({ inputs, stream }) => {
      const { category, limit } = inputs.query
      for (let i = 1; i <= limit; i++) {
        await stream.writeln({ id: i, category })
      }
    })

    const app = createMockServer(apiSchema)
    const response = await app.request(
      '/items/stream?category=electronics&limit=3',
    )

    expect(response.status).toBe(200)
    const text = await response.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(3)

    const items = lines.map((line) => JSON.parse(line))
    expect(items.every((item) => item.category === 'electronics')).toBe(true)
  })

  it('should support POST with JSON stream response', async () => {
    const apiSchema = {
      searchStream: definePost('/search/stream', {
        input: {
          json: z.object({
            query: z.string(),
            maxResults: z.number(),
          }),
        },
        response: defineJSONStream(
          z.object({
            rank: z.number(),
            title: z.string(),
            score: z.number(),
          }),
        ),
      }),
    }

    apiSchema.searchStream.defineMock(async ({ inputs, stream }) => {
      const { query, maxResults } = inputs.json
      for (let i = 1; i <= maxResults; i++) {
        await stream.writeln({
          rank: i,
          title: `Result ${i} for "${query}"`,
          score: 1.0 - i * 0.1,
        })
      }
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/search/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', maxResults: 2 }),
    })

    expect(response.status).toBe(200)
    const text = await response.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(2)

    const results = lines.map((line) => JSON.parse(line))
    expect(results[0].title).toContain('test')
    expect(results[0].rank).toBe(1)
  })

  it('should handle complex nested JSON objects', async () => {
    const apiSchema = {
      streamComplexData: defineGet('/data/complex', {
        response: defineJSONStream(
          z.object({
            id: z.string(),
            metadata: z.object({
              tags: z.array(z.string()),
              counts: z.object({
                views: z.number(),
                likes: z.number(),
              }),
            }),
          }),
        ),
      }),
    }

    apiSchema.streamComplexData.defineMock(async ({ stream }) => {
      await stream.writeln({
        id: 'item-1',
        metadata: {
          tags: ['tag1', 'tag2'],
          counts: {
            views: 100,
            likes: 50,
          },
        },
      })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/data/complex')

    expect(response.status).toBe(200)
    const text = await response.text()
    const data = JSON.parse(text.trim())

    expect(data.id).toBe('item-1')
    expect(data.metadata.tags).toEqual(['tag1', 'tag2'])
    expect(data.metadata.counts.views).toBe(100)
  })

  it('should support async mock with path parameters', async () => {
    const apiSchema = {
      streamUserPosts: defineGet('/users/:userId/posts/stream', {
        response: defineJSONStream(
          z.object({
            postId: z.number(),
            userId: z.string(),
            content: z.string(),
          }),
        ),
      }),
    }

    apiSchema.streamUserPosts.defineMock(async ({ inputs, stream }) => {
      const userId = (inputs.param as { userId: string }).userId

      // Simulate async data fetching
      await new Promise((resolve) => setTimeout(resolve, 10))

      await stream.writeln({
        postId: 1,
        userId,
        content: 'First post',
      })
      await stream.writeln({
        postId: 2,
        userId,
        content: 'Second post',
      })
    })

    const app = createMockServer(apiSchema)
    const response = await app.request('/users/user123/posts/stream')

    expect(response.status).toBe(200)
    const text = await response.text()
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(2)

    const posts = lines.map((line) => JSON.parse(line))
    expect(posts.every((post) => post.userId === 'user123')).toBe(true)
  })
})

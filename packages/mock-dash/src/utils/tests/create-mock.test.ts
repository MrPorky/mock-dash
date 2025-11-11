import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createMock, type MockStructure } from '../create-mock'

// --- Setup Test Types and Context ---

// Define test context interface and default value
type EndpointInputContext = { path: string; source: 'web' | 'mobile' }
type InputContextMapper = { c: EndpointInputContext }
const defaultContext: InputContextMapper = {
  c: { path: '/test', source: 'web' },
}
const mobileContext: InputContextMapper = {
  c: { path: '/test', source: 'mobile' },
}

// Define a simple Zod schema for primitives and basic checks
const SimpleSchema = z.object({
  syncVal: z.string(),
  asyncVal: z.number(),
  contextVal: z.string(),
  directVal: z.boolean(),
})

// Define a complex Zod schema for nested objects and arrays
const NestedSchema = z.object({
  id: z.string(),
  data: z.object({
    count: z.number(),
    status: z.string(),
  }),
  items: z.array(z.string()),
})

// Define a complex Zod schema for the faker array test
const FakerArraySchema = z.object({
  userId: z.string(),
  posts: z.array(
    z.object({
      postId: z.number(),
      title: z.string(),
      // Nested object/function inside the faker-generated item
      details: z.object({
        sourceId: z.string(),
      }),
    }),
  ),
})

// Use fake timers for testing async mocks with setTimeout
vi.useFakeTimers()

// --- Test Suite ---

describe('createMock', () => {
  it('should resolve direct values and simple functions correctly', async () => {
    const mockStructure: MockStructure<
      typeof SimpleSchema,
      InputContextMapper
    > = {
      syncVal: () => 'Sync Result',
      asyncVal: 123, // Direct value
      contextVal: 'Context-free string',
      directVal: true,
    }

    const resultPromise = createMock<typeof SimpleSchema, InputContextMapper>(
      mockStructure,
      defaultContext,
    )

    // No async operations needed, but we await for the final resolution
    const result = await resultPromise

    expect(result.syncVal).toBe('Sync Result')
    expect(result.asyncVal).toBe(123)
    expect(result.contextVal).toBe('Context-free string')
    expect(result.directVal).toBe(true)
    expect(() => SimpleSchema.parse(result)).not.toThrow()
  })

  it('should correctly handle asynchronous functions (MaybePromise<T>)', async () => {
    const mockStructure: MockStructure<
      typeof SimpleSchema,
      InputContextMapper
    > = {
      syncVal: 'Sync Value',
      asyncVal: () =>
        new Promise<number>((resolve) => setTimeout(() => resolve(456), 50)),
      contextVal: 'C',
      directVal: false,
    }

    const resultPromise = createMock<typeof SimpleSchema, InputContextMapper>(
      mockStructure,
      defaultContext,
    )

    // Advance time by only 10ms - result should not be resolved yet
    await vi.advanceTimersByTimeAsync(10)

    // Check that the promise is still pending by racing with a resolved promise
    const raceResult = await Promise.race([
      resultPromise.then(() => 'resolved'),
      Promise.resolve('pending'),
    ])
    expect(raceResult).toBe('pending')

    // Advance time to resolve the promise (40 more ms to reach 50ms total)
    await vi.advanceTimersByTimeAsync(40)

    const result = await resultPromise

    expect(result.asyncVal).toBe(456)
    expect(() => SimpleSchema.parse(result)).not.toThrow()
  })

  it('should correctly inject and use the InputContextMapper', async () => {
    const mockStructure: MockStructure<
      typeof SimpleSchema,
      InputContextMapper
    > = {
      syncVal: 'Test',
      asyncVal: 1,
      contextVal: ({ c }) => `Path: ${c.path} | Source: ${c.source}`,
      directVal: true,
    }

    const result = await createMock<typeof SimpleSchema, InputContextMapper>(
      mockStructure,
      mobileContext,
    )

    expect(result.contextVal).toBe('Path: /test | Source: mobile')
    expect(() => SimpleSchema.parse(result)).not.toThrow()
  })

  it('should recursively resolve nested objects and functions', async () => {
    const mockStructure: MockStructure<
      typeof NestedSchema,
      InputContextMapper
    > = {
      id: 'mock-1',
      data: ({ c }) => ({
        // Object mock is a function
        count: async () => {
          // Nested property is async
          await new Promise((resolve) => setTimeout(resolve, 20))
          return 500
        },
        status: c.source === 'web' ? 'ONLINE' : 'OFFLINE',
      }),
      items: () => ['a', 'b', 'c'],
    }

    const resultPromise = createMock<typeof NestedSchema, InputContextMapper>(
      mockStructure,
      defaultContext,
    )

    // Resolve nested async call
    await vi.advanceTimersByTimeAsync(20)

    const result = await resultPromise

    expect(result.data.count).toBe(500)
    expect(result.data.status).toBe('ONLINE')
    expect(result.items).toEqual(['a', 'b', 'c'])
    expect(() => NestedSchema.parse(result)).not.toThrow()
  })

  it('should resolve arrays defined as explicit Tmock array', async () => {
    const mockStructure: MockStructure<
      typeof NestedSchema,
      InputContextMapper
    > = {
      id: 'id-1',
      data: { count: 10, status: 'READY' },
      // Array defined as an array of Tmock elements
      items: [
        () => 'Item-1',
        'Item-2',
        async () => {
          await new Promise((r) => setTimeout(r, 10))
          return 'Item-3'
        },
      ],
    }

    const resultPromise = createMock<typeof NestedSchema, InputContextMapper>(
      mockStructure,
      defaultContext,
    )

    await vi.advanceTimersByTimeAsync(10)

    const result = await resultPromise

    expect(result.items).toEqual(['Item-1', 'Item-2', 'Item-3'])
    expect(() => NestedSchema.parse(result)).not.toThrow()
  })

  describe('Array Faker Configuration', () => {
    it('should generate a fixed number of items using faker', async () => {
      const mockStructure: MockStructure<
        typeof FakerArraySchema,
        InputContextMapper
      > = {
        userId: 'user-a',
        posts: {
          length: 4,
          faker: ({ index }) => ({
            postId: index + 1,
            title: `Post ${index}`,
            details: { sourceId: 'A' },
          }),
        },
      }

      const result = await createMock<
        typeof FakerArraySchema,
        InputContextMapper
      >(mockStructure, defaultContext)

      expect(result.posts).toHaveLength(4)
      expect(result.posts[0].postId).toBe(1)
      expect(result.posts[3].title).toBe('Post 3')
      expect(() => FakerArraySchema.parse(result)).not.toThrow()
    })

    it('should generate a random number of items within min/max bounds', async () => {
      const mockStructure: MockStructure<
        typeof FakerArraySchema,
        InputContextMapper
      > = {
        userId: 'user-b',
        posts: {
          min: 6,
          max: 8,
          faker: () => ({
            postId: 1,
            title: 'T',
            details: { sourceId: 'A' },
          }),
        },
      }

      // Note: Since getRandomInt is not mocked, this test relies on the function working correctly,
      // but we ensure the resulting length is constrained by the bounds.
      const result = await createMock<
        typeof FakerArraySchema,
        InputContextMapper
      >(mockStructure, defaultContext)
      const length = result.posts.length

      expect(length).toBeGreaterThanOrEqual(6)
      expect(length).toBeLessThanOrEqual(8)
      expect(() => FakerArraySchema.parse(result)).not.toThrow()
    })

    it('should recursively resolve nested Tmock structures returned by faker', async () => {
      const mockStructure: MockStructure<
        typeof FakerArraySchema,
        InputContextMapper
      > = {
        userId: ({ c }) => (c.source === 'mobile' ? 'M-ID' : 'W-ID'),
        posts: {
          length: 1,
          faker: ({ c, index }) => ({
            postId: index + 100,
            // Title is async and uses context
            title: async () => {
              await new Promise((r) => setTimeout(r, 15))
              return `Async Title from ${c.source}`
            },
            // Nested object has a function property
            details: {
              sourceId: () => `SRC-${index}`,
            },
          }),
        },
      }

      const resultPromise = createMock<
        typeof FakerArraySchema,
        InputContextMapper
      >(mockStructure, mobileContext)

      // Resolve nested async call
      await vi.advanceTimersByTimeAsync(15)

      const result = await resultPromise

      expect(result.userId).toBe('M-ID')
      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].title).toBe('Async Title from mobile')
      expect(result.posts[0].details.sourceId).toBe('SRC-0')
      expect(() => FakerArraySchema.parse(result)).not.toThrow()
    })
  })
})

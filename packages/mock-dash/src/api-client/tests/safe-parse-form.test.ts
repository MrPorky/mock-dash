import { describe, expect, it } from 'vitest'
import z from 'zod'
import { definePost } from '../../endpoint/define-endpoint'
import type { HttpEndpoint } from '../../endpoint/http-endpoint'
import type { EndpointCallSignatureResolver } from '../client-type'
import { callHttpEndpoint } from '../http-call'

describe('safeParseForm', () => {
  const createEndpointWithJsonInput = <T extends z.ZodType>(jsonSchema: T) => {
    return definePost('/test', {
      input: { json: jsonSchema },
      response: z.object({ success: z.boolean() }),
    })
  }

  const createHttpCall = <T extends HttpEndpoint<any, any, any, any>>(
    endpoint: T,
  ): EndpointCallSignatureResolver<T> => {
    return callHttpEndpoint(
      {},
      endpoint,
      { baseURL: 'http://localhost' },
      {
        request: { use: () => {}, eject: () => {} } as any,
        response: { use: () => {}, eject: () => {} } as any,
      },
    ) as EndpointCallSignatureResolver<T>
  }

  describe('with valid JSON input schema', () => {
    it('should parse simple form data successfully', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'John Doe')
      formData.append('age', '25')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ name: 'John Doe', age: 25 })
        expect(result.error).toBeUndefined()
      }
    })

    it('should parse simple array form data successfully', () => {
      const schema = z.array(
        z.object({
          name: z.string(),
          age: z.number(),
        }),
      )
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('[0].name', 'John Doe')
      formData.append('[0].age', '25')
      formData.append('[1].name', 'Jane Smith')
      formData.append('[1].age', '30')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([
          { name: 'John Doe', age: 25 },
          { name: 'Jane Smith', age: 30 },
        ])
        expect(result.error).toBeUndefined()
      }
    })

    it('should parse form data with optional fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.email().optional(),
        age: z.number().optional(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Jane Doe')
      formData.append('email', 'jane@example.com')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Jane Doe',
          email: 'jane@example.com',
        })
      }
    })

    it('should parse form data with arrays', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test Item')
      formData.append('tags', 'tag1')
      formData.append('tags', 'tag2')
      formData.append('tags', 'tag3')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test Item',
          tags: ['tag1', 'tag2', 'tag3'],
        })
      }
    })

    it('should handle boolean coercion with type coercion enabled by default', () => {
      const schema = z.object({
        name: z.string(),
        isActive: z.boolean(),
        isVerified: z.boolean(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('isActive', 'true')

      const result = (httpCall.safeParseForm as any)(formData, true)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          isActive: true,
          isVerified: false,
        })
      }
    })

    it('should handle date coercion with type coercion enabled', () => {
      const schema = z.object({
        name: z.string(),
        birthDate: z.date(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('birthDate', '2023-01-15')

      const result = httpCall.safeParseForm(formData, true)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          birthDate: new Date('2023-01-15'),
        })
      }
    })

    it('should handle nested object schemas', () => {
      const schema = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          zipCode: z.string(),
        }),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('address.street', '123 Main St')
      formData.append('address.city', 'New York')
      formData.append('address.zipCode', '10001')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          address: {
            street: '123 Main St',
            city: 'New York',
            zipCode: '10001',
          },
        })
      }
    })

    it('should handle empty string values as undefined', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test Item')
      formData.append('description', '')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test Item',
        })
      }
    })

    it('should disable coercion when autoCoerce is set to false', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('age', '25')

      const result = httpCall.safeParseForm(formData, false)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.data).toBeUndefined()
      }
    })

    it('should return validation errors for invalid data', () => {
      const schema = z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.email('Invalid email format'),
        age: z.number().min(0, 'Age must be positive'),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'A')
      formData.append('email', 'invalid-email')
      formData.append('age', '-5')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.data).toBeUndefined()
        // Verify error structure contains validation issues
        expect(result.error?.properties).toHaveProperty('name')
        expect(result.error?.properties).toHaveProperty('email')
        expect(result.error?.properties).toHaveProperty('age')
      }
    })

    it('should return validation errors for missing required fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')
      // Missing email field

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.data).toBeUndefined()
      }
    })

    it('should handle complex validation scenarios', () => {
      const schema = z.object({
        username: z.string().min(3).max(20),
        email: z.string().email(),
        age: z.number().min(18).max(120),
        tags: z.array(z.string()).min(1, 'At least one tag required'),
        isTermsAccepted: z.boolean().refine((val) => val === true, {
          message: 'Terms must be accepted',
        }),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('username', 'johndoe')
      formData.append('email', 'john@example.com')
      formData.append('age', '25')
      formData.append('tags', 'developer')
      formData.append('tags', 'javascript')
      formData.append('isTermsAccepted', 'true')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          username: 'johndoe',
          email: 'john@example.com',
          age: 25,
          tags: ['developer', 'javascript'],
          isTermsAccepted: true,
        })
      }
    })

    it('should handle default values correctly', () => {
      const schema = z.object({
        name: z.string(),
        role: z.string().default('user'),
        isActive: z.boolean().default(true),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          role: 'user',
          isActive: true,
        })
      }
    })

    it('should handle nullable fields correctly', () => {
      const schema = z.object({
        name: z.string(),
        middleName: z.string().nullable(),
        age: z.number().nullable(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('middleName', '')
      formData.append('age', '25')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          middleName: null,
          age: 25,
        })
      }
    })
  })

  describe('without JSON input schema', () => {
    it('should throw error when no JSON schema is defined', () => {
      // Create an endpoint without json input schema
      const endpointWithoutJson = {
        method: 'post' as const,
        path: '/test',
        input: { query: { search: z.string() } },
        response: z.object({ success: z.boolean() }),
      }

      const httpCall = callHttpEndpoint(
        {},
        endpointWithoutJson as any,
        { baseURL: 'http://localhost' },
        {
          request: { use: () => {}, eject: () => {} } as any,
          response: { use: () => {}, eject: () => {} } as any,
        },
      )

      const formData = new FormData()
      formData.append('test', 'value')

      expect(() => httpCall.safeParseForm(formData)).toThrow(
        'No JSON input schema defined for this endpoint',
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty form data', () => {
      const schema = z.object({
        name: z.string().optional(),
        age: z.number().optional(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })

    it('should handle form data with null values', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().nullable(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test')
      formData.append('description', 'null')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test',
          description: 'null', // String 'null' is not converted to null
        })
      }
    })

    it('should handle very large form data', () => {
      const schema = z.object({
        content: z.string(),
        metadata: z.array(z.string()),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const largeString = 'x'.repeat(10000)
      const formData = new FormData()
      formData.append('content', largeString)
      for (let i = 0; i < 100; i++) {
        formData.append('metadata', `item-${i}`)
      }

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).content).toBe(largeString)
        expect((result.data as any).metadata).toHaveLength(100)
      }
    })

    it('should handle special characters in form data', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test & Co. "Special" <chars>')
      formData.append('description', 'Multi\nline\ttext with émojis 🎉')

      const result = httpCall.safeParseForm(formData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test & Co. "Special" <chars>',
          description: 'Multi\nline\ttext with émojis 🎉',
        })
      }
    })
  })

  describe('type safety', () => {
    it('should maintain proper data types in parsed results', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        isActive: z.boolean(),
      })
      const endpoint = createEndpointWithJsonInput(schema)
      const httpCall = createHttpCall(endpoint)

      const formData = new FormData()
      formData.append('name', 'Test')
      formData.append('age', '25')
      formData.append('isActive', 'true')

      const result = httpCall.safeParseForm(formData)

      if (result.success) {
        // These should have the correct runtime types
        const data = result.data as any
        expect(typeof data.name).toBe('string')
        expect(typeof data.age).toBe('number')
        expect(typeof data.isActive).toBe('boolean')

        expect(data.name).toBe('Test')
        expect(data.age).toBe(25)
        expect(data.isActive).toBe(true)
      }
    })
  })
})

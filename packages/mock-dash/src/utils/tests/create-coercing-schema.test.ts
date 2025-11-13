import { describe, expect, it } from 'vitest'
import z from 'zod'
import { createCoercingSchema } from '../create-coercing-schema'

describe('createCoercingSchema', () => {
  it('should throw error for non-ZodType schema', () => {
    // @ts-expect-error Testing invalid input
    expect(() => createCoercingSchema('not a schema')).toThrow(
      'Expected a z.ZodType schema',
    )
    // @ts-expect-error Testing invalid input
    expect(() => createCoercingSchema({})).toThrow(
      'Expected a z.ZodType schema',
    )
    // @ts-expect-error Testing invalid input
    expect(() => createCoercingSchema(null)).toThrow(
      'Expected a z.ZodType schema',
    )
  })

  it('should handle ZodObject schemas', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    })

    const coercingSchema = createCoercingSchema(schema)

    // Should coerce string numbers to numbers
    const result = coercingSchema.parse({
      name: 'John',
      age: '25',
      active: 'true',
    })

    expect(result).toEqual({
      name: 'John',
      age: 25,
      active: true,
    })
  })

  it('should handle nested ZodObject schemas', () => {
    const schema = z.object({
      user: z.object({
        id: z.number(),
        profile: z.object({
          score: z.number(),
        }),
      }),
    })

    const coercingSchema = createCoercingSchema(schema)

    const result = coercingSchema.parse({
      user: {
        id: '123',
        profile: {
          score: '95.5',
        },
      },
    })

    expect(result).toEqual({
      user: {
        id: 123,
        profile: {
          score: 95.5,
        },
      },
    })
  })

  it('should handle ZodArray schemas', () => {
    const schema = z.array(z.number())
    const coercingSchema = createCoercingSchema(schema)

    const result = coercingSchema.parse(['1', '2', '3'])
    expect(result).toEqual([1, 2, 3])
  })

  it('should handle nested arrays in objects', () => {
    const schema = z.object({
      numbers: z.array(z.number()),
      tags: z.array(z.string()),
    })

    const coercingSchema = createCoercingSchema(schema)

    const result = coercingSchema.parse({
      numbers: ['1', '2', '3'],
      tags: ['tag1', 'tag2'],
    })

    expect(result).toEqual({
      numbers: [1, 2, 3],
      tags: ['tag1', 'tag2'],
    })
  })

  it('should handle ZodOptional schemas', () => {
    const schema = z.number().optional()
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse('42')).toBe(42)
    expect(coercingSchema.parse(undefined)).toBeUndefined()
  })

  it('should handle ZodNullable schemas', () => {
    const schema = z.number().nullable()
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse('42')).toBe(42)
    expect(coercingSchema.parse(null)).toBeNull()
  })

  it('should handle ZodDefault schemas', () => {
    const schema = z.number().default(10)
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse('42')).toBe(42)
    expect(coercingSchema.parse(undefined)).toBe(10)
  })

  it('should handle ZodNumber schemas with coercion', () => {
    const schema = z.number()
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse('42')).toBe(42)
    expect(coercingSchema.parse('3.14')).toBe(3.14)
    expect(() => coercingSchema.parse('not a number')).toThrow()
  })

  it('should handle ZodBigInt schemas with coercion', () => {
    const schema = z.bigint()
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse('42')).toBe(42n)
    expect(coercingSchema.parse(42)).toBe(42n)
  })

  it('should handle ZodBoolean schemas with coercion', () => {
    const schema = z.boolean()
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse('true')).toBe(true)
    expect(coercingSchema.parse('on')).toBe(true)
    expect(coercingSchema.parse(1)).toBe(true)
    expect(coercingSchema.parse(0)).toBe(false)
  })

  it('should handle ZodDate schemas with coercion', () => {
    const schema = z.date()
    const coercingSchema = createCoercingSchema(schema)

    const dateString = '2023-12-25T00:00:00.000Z'
    const result = coercingSchema.parse(dateString) as Date

    expect(result).toBeInstanceOf(Date)
    expect(result.toISOString()).toBe(dateString)
  })

  it('should handle ZodString schemas with coercion', () => {
    const schema = z.string()
    const coercingSchema = createCoercingSchema(schema)

    expect(coercingSchema.parse(42)).toBe('42')
    expect(coercingSchema.parse(true)).toBe('true')
    expect(coercingSchema.parse('hello')).toBe('hello')
  })

  it('should handle complex nested optional and nullable schemas', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.number().optional(),
      nullable: z.boolean().nullable(),
      optionalNullable: z.string().optional().nullable(),
      nested: z
        .object({
          value: z.number().optional(),
        })
        .optional(),
    })

    const coercingSchema = createCoercingSchema(schema)

    const result = coercingSchema.parse({
      required: 'test',
      optional: '42',
      nullable: 'true',
      optionalNullable: null,
      nested: {
        value: '100',
      },
    })

    expect(result).toEqual({
      required: 'test',
      optional: 42,
      nullable: true,
      optionalNullable: null,
      nested: {
        value: 100,
      },
    })
  })

  it('should return original schema for unsupported types', () => {
    const schema = z.enum(['a', 'b', 'c'])
    const coercingSchema = createCoercingSchema(schema)

    // Should work the same as original schema
    expect(coercingSchema.parse('a')).toBe('a')
    expect(() => coercingSchema.parse('d')).toThrow()
  })
})

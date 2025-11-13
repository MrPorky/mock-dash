import z from 'zod'

export function createCoercingSchema<T extends z.ZodType>(schema: T): T {
  if (!(schema instanceof z.ZodType)) {
    throw new Error('Expected a z.ZodType schema')
  }

  if (schema instanceof z.ZodObject) {
    const originalShape = schema.shape
    const newShape: typeof originalShape = {}

    for (const key in originalShape) {
      newShape[key] = createCoercingSchema(originalShape[key])
    }

    return new z.ZodObject({
      ...schema.def,
      shape: newShape,
    }) as unknown as T
  }

  if (schema instanceof z.ZodArray) {
    const elementType = schema.element
    if (!(elementType instanceof z.ZodType)) return schema

    const newElementType = createCoercingSchema(elementType)

    return new z.ZodArray({
      ...schema.def,
      element: newElementType,
    }) as unknown as T
  }

  if (schema instanceof z.ZodOptional) {
    const baseType = schema.unwrap()
    if (!(baseType instanceof z.ZodType)) return schema

    return createCoercingSchema(baseType).optional() as unknown as T
  }

  if (schema instanceof z.ZodNullable) {
    const baseType = schema.unwrap()
    if (!(baseType instanceof z.ZodType)) return schema

    return createCoercingSchema(baseType).nullable() as unknown as T
  }

  if (schema instanceof z.ZodDefault) {
    const baseType = schema.unwrap()
    if (!(baseType instanceof z.ZodType)) return schema

    return createCoercingSchema(baseType).default(
      schema.def.defaultValue,
    ) as unknown as T
  }

  if (schema instanceof z.ZodNumber) {
    return new z.ZodNumber({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  if (schema instanceof z.ZodBigInt) {
    return new z.ZodBigInt({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  if (schema instanceof z.ZodBoolean) {
    return new z.ZodBoolean({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  if (schema instanceof z.ZodDate) {
    return new z.ZodDate({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  if (schema instanceof z.ZodNumber) {
    return new z.ZodNumber({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  if (schema instanceof z.ZodStringFormat) {
    return new z.ZodStringFormat({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  if (schema instanceof z.ZodString) {
    return new z.ZodString({
      ...schema.def,
      coerce: true,
    }) as unknown as T
  }

  return schema
}

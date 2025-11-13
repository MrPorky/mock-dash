import z from 'zod'

function getBaseType(schema: unknown): z.ZodType {
  if (!(schema instanceof z.ZodType)) {
    throw new Error('Expected a z.ZodType schema')
  }

  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  ) {
    return getBaseType(schema.unwrap())
  }

  return schema
}

function extractNestedObjectFields(
  formData: FormData,
  schema: z.ZodObject<any>,
  prefix = '',
): Record<string, unknown> {
  const output: Record<string, unknown> = {}

  for (const key in schema.shape) {
    const fieldSchema = schema.shape[key] as z.ZodType
    const baseType = getBaseType(fieldSchema)
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (baseType instanceof z.ZodObject) {
      // Handle nested objects recursively
      const nestedOutput = extractNestedObjectFields(
        formData,
        baseType,
        fullKey,
      )
      if (Object.keys(nestedOutput).length > 0) {
        output[key] = nestedOutput
      }
    } else if (baseType instanceof z.ZodArray) {
      const values = formData.getAll(fullKey)
      if (fieldSchema instanceof z.ZodOptional && values.length === 0)
        output[key] = undefined
      else output[key] = values
    } else {
      const value = formData.get(fullKey)
      if (value !== null) {
        if (
          fieldSchema instanceof z.ZodNullable ||
          baseType instanceof z.ZodNull
        ) {
          output[key] = value === '' ? null : value
        } else {
          output[key] = value === '' ? undefined : value
        }
      }
    }
  }

  return output
}

export const extractFromFormData = <T extends z.ZodObject>(
  formData: FormData,
  schema: T,
): z.ZodSafeParseResult<z.infer<T>> => {
  const output: Record<string, unknown> = {}

  // First, try to extract fields using the nested approach
  const nestedOutput = extractNestedObjectFields(formData, schema)
  Object.assign(output, nestedOutput)

  return schema.safeParse(output)
}

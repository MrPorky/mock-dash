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
    const isOptionalField = fieldSchema instanceof z.ZodOptional

    if (baseType instanceof z.ZodObject) {
      if (isOptionalField) {
        const hasChildKeys = Array.from(formData.keys()).some((formKey) =>
          formKey.startsWith(fullKey),
        )

        if (!hasChildKeys) {
          output[key] = undefined
          continue
        }
      }

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
      const arrayElementType = getBaseType(baseType.element)

      if (arrayElementType instanceof z.ZodObject) {
        // Handle arrays of objects with indexed notation like array[0].field
        const arrayItems = extractArrayOfObjects(
          formData,
          arrayElementType,
          fullKey,
        )
        if (fieldSchema instanceof z.ZodOptional && arrayItems.length === 0) {
          output[key] = undefined
        } else {
          output[key] = arrayItems
        }
      } else {
        // Handle arrays of primitives
        const values = formData.getAll(fullKey)
        if (fieldSchema instanceof z.ZodOptional && values.length === 0)
          output[key] = undefined
        else output[key] = values
      }
    } else {
      const value = formData.get(fullKey)

      if (value !== null && value !== '') {
        output[key] = value
      } else if (
        fieldSchema instanceof z.ZodNullable ||
        baseType instanceof z.ZodNull
      ) {
        output[key] = null
      } else if (fieldSchema instanceof z.ZodOptional) {
        output[key] = undefined
      } else if (
        fieldSchema instanceof z.ZodString ||
        fieldSchema instanceof z.ZodStringFormat
      ) {
        output[key] = ''
      }
    }
  }

  return output
}

function extractArrayOfObjects(
  formData: FormData,
  objectSchema: z.ZodObject<any>,
  arrayFieldName: string,
): Record<string, unknown>[] {
  const arrayItems: Map<number, Record<string, unknown>> = new Map()
  const arrayPattern = new RegExp(
    `^${escapeRegExp(arrayFieldName)}\\[(\\d+)\\]\\.(.+)$`,
  )
  const fieldIndexes: Set<number> = new Set()
  for (const key of formData.keys()) {
    const match = key.match(arrayPattern)?.[1]
    if (match) {
      fieldIndexes.add(parseInt(match, 10))
    }
  }

  // Collect all form data entries that match the array pattern
  for (const index of fieldIndexes) {
    const fieldPath = `${arrayFieldName}[${index}]`
    const nestedOutput = extractNestedObjectFields(
      formData,
      objectSchema,
      fieldPath,
    )
    arrayItems.set(index, nestedOutput)
  }

  return Array.from(arrayItems.values())
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

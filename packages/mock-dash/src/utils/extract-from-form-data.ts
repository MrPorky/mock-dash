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
    output[key] = extractFromDataFromZodType(
      formData,
      schema.shape[key],
      prefix ? `${prefix}.${key}` : key,
    )
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

function extractFromDataFromZodType(
  formData: FormData,
  fieldSchema: z.ZodType,
  prefix = '',
) {
  const baseType = getBaseType(fieldSchema)
  const isOptionalField = fieldSchema instanceof z.ZodOptional

  if (baseType instanceof z.ZodObject) {
    if (isOptionalField) {
      const hasChildKeys = Array.from(formData.keys()).some((formKey) =>
        formKey.startsWith(prefix),
      )

      if (!hasChildKeys) {
        return undefined
      }
    }

    // Handle nested objects recursively
    const nestedOutput = extractNestedObjectFields(formData, baseType, prefix)

    if (Object.keys(nestedOutput).length > 0) {
      return nestedOutput
    }
  } else if (baseType instanceof z.ZodArray) {
    const arrayElementType = getBaseType(baseType.element)

    if (arrayElementType instanceof z.ZodObject) {
      // Handle arrays of objects with indexed notation like array[0].field
      const arrayItems = extractArrayOfObjects(
        formData,
        arrayElementType,
        prefix,
      )
      if (fieldSchema instanceof z.ZodOptional && arrayItems.length === 0) {
        return undefined
      } else {
        return arrayItems
      }
    } else {
      // Handle arrays of primitives
      const values = formData.getAll(prefix)
      if (fieldSchema instanceof z.ZodOptional && values.length === 0)
        return undefined
      else return values
    }
  } else {
    const value = formData.get(prefix)

    if (value !== null && value !== '') {
      return value
    } else if (
      fieldSchema instanceof z.ZodNullable ||
      baseType instanceof z.ZodNull
    ) {
      return null
    } else if (fieldSchema instanceof z.ZodOptional) {
      return undefined
    } else if (
      fieldSchema instanceof z.ZodString ||
      fieldSchema instanceof z.ZodStringFormat
    ) {
      return ''
    }
  }
}

export const extractFromFormData = <T extends z.ZodType>(
  formData: FormData,
  schema: T,
): z.ZodSafeParseResult<z.infer<T>> => {
  const output = extractFromDataFromZodType(formData, schema)

  return schema.safeParse(output)
}

/**
 * Serializes an object of query parameters into a URL-encoded query string.
 * Handles arrays, nested objects, and null/undefined values appropriately.
 * Arrays are serialized by repeating the key for each value, and nested objects
 * are flattened using bracket notation (e.g., `filter[name]=value`).
 */
export function serializeQueryParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()

  function addParam(key: string, value: unknown) {
    if (value === undefined || value === null) {
      return
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return
      }
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          searchParams.append(key, String(item))
        }
      })
    } else if (typeof value === 'object' && value !== null) {
      // Handle nested objects by flattening them
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        addParam(`${key}[${nestedKey}]`, nestedValue)
      })
    } else {
      searchParams.append(key, String(value))
    }
  }

  Object.entries(params).forEach(([key, value]) => {
    addParam(key, value)
  })

  return searchParams.toString()
}

/**
 * Builds a FormData object from a plain JavaScript object, handling files, arrays,
 * nested objects, and null/undefined values appropriately. This is used for
 * multipart/form-data requests, particularly for file uploads and complex form submissions.
 */
export function buildFormData(data: Record<string, unknown>): FormData {
  const formData = new FormData()

  function addFormField(key: string, value: unknown) {
    if (value === undefined || value === null) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          if (item instanceof File) {
            formData.append(key, item, item.name)
          } else {
            formData.append(key, String(item))
          }
        }
      })
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !(value instanceof File)
    ) {
      // Handle nested objects by flattening them
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        addFormField(`${key}[${nestedKey}]`, nestedValue)
      })
    } else if (value instanceof File) {
      formData.append(key, value, value.name)
    } else {
      formData.append(key, String(value))
    }
  }

  Object.entries(data).forEach(([key, value]) => {
    addFormField(key, value)
  })

  return formData
}

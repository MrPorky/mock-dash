/**
 * Recursively merges the properties of one or more source objects into a target object.
 * This is crucial for building the nested API client structure.
 *
 * @param target The object to receive the merge (will be modified).
 * @param sources The objects to merge into the target.
 * @returns The merged target object.
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: any[]
): T {
  if (!sources.length) {
    return target
  }
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        // If the value is a plain object, create the property on target if it doesn't exist,
        // and then recursively merge.
        if (!target[key]) {
          Object.assign(target, { [key]: {} })
        }
        deepMerge(target[key], source[key])
      } else {
        // Otherwise, simply assign the value (this also handles functions, arrays, and primitives)
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  // Continue with the next source object, if any
  return deepMerge(target, ...sources)
}

/**
 * Helper function to check if a value is a plain object (excluding arrays and null).
 * @param item The value to check.
 * @returns True if the value is a plain object.
 */
function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item)
}
